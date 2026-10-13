# Gliffon ◆

> A next-generation symbolic social platform — express emotions, memories, and creativity through digital glyphs.

Gliffon helps you say what words can't. Instead of posts and likes, you cast **glyphs** — small symbolic expressions of what you feel, remember, or imagine. It's built to be a **Progressive Web App (PWA)**: installable, offline-capable, local-first, and extremely fast (≈ 9 KB gzipped app code).

---

## ✨ Features (Phase 1 MVP)

| Feature | Description |
|---|---|
| **Onboarding** | Choose your name and a personal glyph symbol when you first launch |
| **Glyph Composer** | Cast glyphs across four kinds: **Love 💗, Mood 🌤️, Memory 🕯️, Creativity 🪄** |
| **Timeline** | Color-coded, timestamped glyph history with delete support |
| **Sharing** | Share any glyph via the native share sheet (Web Share API) or clipboard fallback |
| **Daily Reminder** | Opt-in local notification prompting you to cast your daily glyph |
| **Profile** | Personal glyph name, member-since date, and glyph count |
| **Offline-first** | All data lives in IndexedDB; the app works entirely offline thanks to a precaching service worker |

All glyphs are color-coded by kind:

- <kbd style="color:#ff5c8a">■</kbd> Love — accent pink
- <kbd style="color:#ffd166">■</kbd> Mood — warm yellow
- <kbd style="color:#8a7bff">■</kbd> Memory — violet
- <kbd style="color:#4dd9a8">■</kbd> Creativity — mint

## 🚀 Getting started

**Prerequisites:** Node.js ≥ 18 and npm.

```bash
# install dependencies
npm install

# start the dev server
npm run dev

# production build (outputs dist/ with full PWA service worker)
npm run build

# preview the production build locally
npm run preview
```

### Installing as an app

Serve the build over HTTPS (or localhost), then use your browser's **Install / Add to Home Screen** option. Once installed, Gliffon runs standalone and works fully offline.

## 🏗 Architecture

```
index.html            App shell
public/icon.svg       App icon
src/
  main.jsx            Entry point
  app.jsx             Shell, tabs, timeline, profile
  composer.jsx        Glyph composer UI
  onboarding.jsx      First-run experience
  store.ts            Local-first data layer (IndexedDB via idb)
  share.js            Web Share API + notification helpers
  styles.css          Hand-rolled CSS design system
  types.ts            Domain types
```

**Key design decisions**

- **Local-first storage** — `store.ts` exposes a swappable adapter interface (`getProfile`, `addGlyph`, `listGlyphs`, …) backed by IndexedDB today. A cloud-sync adapter (e.g. Supabase free tier) can be dropped in later without touching the UI.
- **Tiny footprint** — Preact (3 kB) instead of React, no UI framework, hand-written CSS. The whole production bundle is ~9 KB gzipped.
- **PWA everywhere** — auto-updating service worker precaches all app assets for instant offline loads.

## 🗺 Roadmap

- **Phase 1 ✅** — MVP: onboarding, glyph composer, timeline, local storage
- **Phase 2** — Advanced glyph customization (colors, animations, composed glyphs)
- **Phase 3** — Community features: community wall, social sharing, cross-device sync
- **Phase 4** — Monetization: premium glyph packs, memory vault subscription
- **Phase 5** — Global expansion

## 🤝 Contributing

1. Fork and branch from `master`
2. Keep the bundle tiny — prefer plain CSS and small dependencies
3. Run `npm run build` before committing to verify the PWA build passes

## 📄 License

MIT © 2026 John Leshan
