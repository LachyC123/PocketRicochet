// Toy-cabinet palette from the art brief, plus a few derived shades.
export const PALETTE = {
  cream: 0xfff2d7,
  creamShade: 0xf3dfb8,
  pegDot: 0xead2a4,
  ink: 0x203047,
  inkLight: 0x2c4060,
  inkSoft: 0x3a5274,
  strip: 0x283b57,
  coral: 0xf3695c,
  coralDark: 0xc9473c,
  teal: 0x38b8ae,
  tealDark: 0x23887f,
  tealLight: 0x7fdad2,
  yellow: 0xf4c94f,
  yellowDark: 0xc99a1e,
  wood: [0xd9965a, 0xcf8a4c, 0xe0a468],
  woodDark: 0x9c6230,
  woodLight: 0xf0bf86,
  tin: 0xdfe5ec,
  tinDark: 0xaab4c0,
  paint: [0xf3695c, 0x38b8ae, 0x8b6fd6, 0x6cc04a],
  returnBlue: 0x4c8dff,
  white: 0xffffff,
} as const;

export const FONT = '"Nunito", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export const CSS = {
  cream: '#FFF2D7',
  ink: '#203047',
  coral: '#F3695C',
  yellow: '#F4C94F',
  teal: '#38B8AE',
} as const;
