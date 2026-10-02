import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { uid } from './store.js';

// Freehand glyph painter — a standalone full-screen canvas. Strokes are plain
// SVG paths (per-stroke colour + width), which keeps them vector, tiny, and
// server-safely renderable anywhere a glyph renders.

const PORTRAIT = { w: 640, h: 800 };
const LANDSCAPE = { w: 800, h: 640 };
const DRAFT_KEY = 'gliffon.paint.draft';

// Midnight brand colours are featured first; the full palette comes with the
// swatch they land on being free — plus a native picker for anything at all.
const FEATURED = [
  '#ffffff', '#ffc46b', '#ff5d9f', '#8b7bff', '#5d63e6',
  '#4d55cc', '#00e5ff', '#54d977', '#ff8a3d', '#eef2ff'
];

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.orientation && Array.isArray(d.strokes) ? d : null;
  } catch { return null; }
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Minimum distance from a point to a stroke's polyline, in canvas units.
function strokeDistance(pts, x, y) {
  let best = Infinity, from = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const to = pts[i];
    // point-to-segment distance
    const dx = to.x - from.x, dy = to.y - from.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((x - from.x) * dx + (y - from.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, dist(from.x + t * dx, from.y + t * dy, x, y));
    from = to;
  }
  return best;
}

const pathD = (pts) => {
  if (!pts.length) return '';
  let d = `M${Math.round(pts[0].x)} ${Math.round(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += `L${Math.round(pts[i].x)} ${Math.round(pts[i].y)}`;
  return d;
};

// The exact grammar api/_db.js:cleanSvg() whitelists — keep them in sync.
export function buildSvg(strokes, w, h) {
  const paths = strokes
    .map((s) => `<path d="${pathD(s.pts)}" stroke="${s.color}" stroke-width="${s.w}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

// Render an already-stored svg string (from the server or a draft) as a glyph.
// The string was emitted by buildSvg and is re-validated at the server on
// every post; client-sourced drafts come from our own builder. The viewBox
// gives the wrapper a definite aspect-ratio, which is what makes the svg
// itself size correctly everywhere it renders (an svg with no dimensions
// collapses to 0 height inside flex parents).
export function PaintedGlyph({ svg }) {
  if (!svg) return null;
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/) || [];
  const ar = vb[1] && vb[2] ? `${vb[1]} / ${vb[2]}` : undefined;
  return h('div', {
    class: 'paintedglyph',
    style: ar ? `aspect-ratio:${ar}` : undefined,
    dangerouslySetInnerHTML: { __html: svg }
  });
}

export function Paint({ profile, backendOK, backend, onCast, notify }) {
  const draft = useRef(null);
  if (draft.current === null) draft.current = loadDraft();

  const [strokes, setStrokes] = useState(() => (draft.current || {}).strokes || []);
  const [orientation, setOrientation] = useState(() =>
    (draft.current || {}).orientation
    || (() => { try { return localStorage.getItem('gliffon.paint.orientation'); } catch { return null; } })()
  );
  const [color, setColor] = useState(FEATURED[1]);
  const [brush, setBrush] = useState(6);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [redo, setRedo] = useState([]);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]); // saved paintings shelf
  const drawing = useRef(false);
  const cur = useRef(null);
  const svgEl = useRef(null);

  const size = orientation === 'portrait' ? PORTRAIT : LANDSCAPE;

  const pickOrientation = (o) => {
    setOrientation(o);
    try { localStorage.setItem('gliffon.paint.orientation', o); } catch {}
    // An orientation that comes from storage alone may have remembered strokes
    // from an old draft — those stay, they belonged to the same shape.
  };

  // Draft autosave: every finished stroke (and orientation change) lands in
  // localStorage, so a refresh or crash never loses a painting in progress.
  useEffect(() => {
    if (!orientation) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ orientation, strokes }));
    } catch { /* storage full/off — painting still works */ }
  }, [strokes, orientation]);

  // My saved paintings (only meaningful with the backend).
  useEffect(() => {
    (async () => {
      if (!backendOK || !backend) return;
      try { setMine(await backend.listPaintings()); } catch { /* not yet signed in etc. */ }
    })();
  }, [backendOK]);

  const undo = useCallback(() => {
    setStrokes((s) => {
      if (!s.length) return s;
      setRedo((r) => [...r, s[s.length - 1]]);
      return s.slice(0, -1);
    });
  }, []);

  const redoLast = useCallback(() => {
    setRedo((r) => {
      if (!r.length) return r;
      const last = r[r.length - 1];
      setStrokes((s) => [...s, last]);
      return r.slice(0, -1);
    });
  }, []);

  const clear = () => {
    setStrokes((s) => { setRedo((r) => [...r, ...s]); return []; });
  };

  const discardDraft = () => {
    setStrokes([]); setRedo([]); setLabel(''); setNote('');
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    notify('Draft discarded');
  };

  // Freehand: pointer (touch + mouse + pen all speak pointer events).
  const pt = (e) => {
    const r = svgEl.current.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - r.left) / r.width) * size.w),
      y: Math.round(((e.clientY - r.top) / r.height) * size.h)
    };
  };

  const down = (e) => {
    e.preventDefault();
    svgEl.current.setPointerCapture?.(e.pointerId);
    const p = pt(e);
    if (tool === 'eraser') {
      // Remove the topmost stroke the eraser touches; the redo stack
      // represents undone strokes, which an erase replaces entirely.
      setRedo([]);
      setStrokes((s) => {
        for (let i = s.length - 1; i >= 0; i--) {
          if (strokeDistance(s[i].pts, p.x, p.y) <= s[i].w + 12) return s.filter((_, j) => j !== i);
        }
        return s;
      });
      return;
    }
    drawing.current = true;
    cur.current = { pts: [p], color, w: brush };
    setStrokes((s) => [...s, cur.current]);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pt(e);
    const pts = cur.current.pts;
    const last = pts[pts.length - 1];
    // decimate tiny jitters; big gaps just become fast segments
    if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) < 3) return;
    pts.push(p);
    setStrokes((s) => [...s]); // re-render the growing stroke
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    cur.current = null;
    setRedo([]); // a new stroke invalidates the redo stack
  };

  const cast = async () => {
    if (!strokes.length || !label.trim() || busy) {
      if (strokes.length && !label.trim()) notify('Give it a name first');
      else if (busy) notify('Casting…');
      else notify('Paint something first');
      return;
    }
    setBusy(true);
    try {
      await onCast({
        id: uid(),
        kind: 'painted',
        symbol: '✦',
        label: label.trim(),
        note: note.trim() || undefined,
        svg: buildSvg(strokes, size.w, size.h)
      });
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setStrokes([]); setRedo([]); setLabel(''); setNote('');
    } finally { setBusy(false); }
  };

  const saveToShelf = async () => {
    if (!strokes.length) { notify('Paint something first'); return; }
    if (!backendOK || !backend) { notify('Connect to save to your collection'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await backend.savePainting(buildSvg(strokes, size.w, size.h));
      setMine(await backend.listPaintings());
      notify('Saved to your collection ✓');
    } catch (e) { notify(e.message); }
    finally { setBusy(false); }
  };

  const castSaved = async (p) => {
    if (!label.trim()) { notify('Name it below, then tap cast'); return; }
    // Pull viewBox out of the stored svg to rebuild at the right aspect.
    const vb = p.svg.match(/viewBox="0 0 (\d+) (\d+)"/) || [];
    if (backendOK && backend) {
      try {
        await onCast({
          id: uid(), kind: 'painted', symbol: '✦',
          label: label.trim(), note: note.trim() || undefined,
          svg: p.svg, vbW: vb[1] ? +vb[1] : undefined, vbH: vb[2] ? +vb[2] : undefined
        });
        setLabel(''); setNote('');
      } catch (e) { notify(e.message); }
    }
  };

  const delSaved = async (p) => {
    try {
      await backend.removePainting(p.id);
      setMine((m) => m.filter((x) => x.id !== p.id));
      notify('Removed');
    } catch (e) { notify(e.message); }
  };

  // First visit (or no orientation yet): choose the canvas.
  if (!orientation) {
    return h('section', { class: 'paint' },
      h('div', { class: 'composerhead' },
        h('p', { class: 'eyebrow' }, 'The paint screen'),
        h('h3', null, 'Paint a glyph')
      ),
      h('p', { class: 'sub' }, 'Freehand strokes in full colour. Pick your canvas shape — you can rotate nothing later, choose the frame that fits the feeling.'),
      h('div', { class: 'orientation' },
        h('button', { class: 'orientcard portrait', onClick: () => pickOrientation('portrait') },
          h('i', null),
          h('b', null, 'Portrait'),
          h('span', { class: 'sub' }, 'tall · 640×800')
        ),
        h('button', { class: 'orientcard landscape', onClick: () => pickOrientation('landscape') },
          h('i', { class: 'wide' }),
          h('b', null, 'Landscape'),
          h('span', { class: 'sub' }, 'wide · 800×640')
        )
      ),
      draft.current && draft.current.strokes?.length
        ? h('button', { class: 'btn primary', onClick: () => { pickOrientation(draft.current.orientation || 'portrait'); setStrokes(draft.current.strokes || []); notify('Draft restored'); } },
            `Restore draft (${draft.current.strokes.length} strokes)`)
        : null
    );
  }

  return h('section', { class: 'paint on' },
    h('div', { class: 'paintbar' },
      h('div', { class: 'palettetools' },
        h('div', { class: 'palette' },
          FEATURED.map((c) =>
            h('button', { key: c, class: 'swatch' + (color === c ? ' picked' : ''), style: `background:${c}`, 'aria-label': 'color ' + c, onClick: () => { setColor(c); setTool('pen'); } })
          ),
          h('input', { class: 'swatchpicker', type: 'color', value: color, 'aria-label': 'custom color', onInput: (e) => { setColor(e.currentTarget.value); setTool('pen'); } })
        ),
        h('div', { class: 'tools' },
          h('button', { class: 'tool' + (tool === 'pen' ? ' on' : ''), onClick: () => setTool('pen') },
            h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' },
              h('path', { d: 'M17 3l4 4L8 20l-5 1 1-5L17 3z' })
            ), 'pen'),
          h('button', { class: 'tool' + (tool === 'eraser' ? ' on' : ''), onClick: () => setTool('eraser') },
            h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' },
              h('path', { d: 'M20 20H8l-5-5 9-9 8 8-4 4' })
            ), 'erase'),
          h('label', { class: 'brushlabel' },
            h('input', { type: 'range', min: 2, max: 24, value: brush, onInput: (e) => setBrush(+e.currentTarget.value), 'aria-label': 'brush size' }),
            h('small', null, brush + 'px')
          )
        )
      ),
      h('div', { class: 'paintactions' },
        h('button', { class: 'btn ghost tiny', onClick: undo, disabled: !strokes.length }, 'Undo'),
        h('button', { class: 'btn ghost tiny', onClick: redoLast, disabled: !redo.length }, 'Redo'),
        h('button', { class: 'btn ghost tiny', onClick: clear, disabled: !strokes.length }, 'Clear'),
        h('button', { class: 'btn ghost tiny', onClick: discardDraft, disabled: !strokes.length }, 'Discard draft')
      )
    ),
    h('div', { class: 'paintcanvas' },
      h('svg', {
        ref: svgEl, class: 'paintbox' + (tool === 'eraser' ? ' erasing' : ''),
        viewBox: `0 0 ${size.w} ${size.h}`,
        onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerLeave: up,
        onPointerCancel: up
      },
        h('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
          strokes.map((s, i) =>
            h('path', { key: i, d: pathD(s.pts), stroke: s.color, 'stroke-width': s.w })
          )
        )
      )
    ),
    h('div', { class: 'castform' },
      h('input', {
        class: 'field', placeholder: 'Name that feeling…', value: label, maxLength: 40,
        onInput: (e) => setLabel(e.currentTarget.value)
      }),
      h('input', {
        class: 'field', placeholder: 'Optional note…', value: note, maxLength: 200,
        onInput: (e) => setNote(e.currentTarget.value)
      }),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary cast', onClick: cast, disabled: busy || !strokes.length || !label.trim() }, 'Cast painted glyph ✦'),
        h('button', { class: 'btn ghost', onClick: saveToShelf, disabled: busy || !strokes.length }, 'Save to collection')
      )
    ),
    mine.length > 0 && h('div', { class: 'shelf' },
      h('div', { class: 'keyinfo' },
        h('b', null, 'My glyphs'),
        h('span', { class: 'sub' }, 'saved paintings — tap one, name it, cast it')
      ),
      h('div', { class: 'shelfgrid' },
        mine.map((p) =>
          h('div', { class: 'shelfitem', key: p.id },
            h('button', { class: 'shelfpick', onClick: () => castSaved(p), title: 'cast this' },
              h(PaintedGlyph, { svg: p.svg })
            ),
            h('button', { class: 'shelfdel', 'aria-label': 'remove painting', onClick: () => delSaved(p) }, '×')
          )
        )
      )
    )
  );
}
