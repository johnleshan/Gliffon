export type GlyphKind = 'love' | 'mood' | 'memory' | 'creativity' | 'painted';

export interface Glyph {
  id: string;
  kind: GlyphKind;
  symbol: string;
  label: string;
  note?: string;
  created: number;
  moodTag?: string;
  svg?: string;
}

export interface Profile {
  name: string;
  glyphName: string;
  joined: number;
}
