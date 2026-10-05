import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Shape {
  t: 'path' | 'circle' | 'rect';
  fill?: string;
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rx?: number;
}

interface Glyph {
  stroke: number;
  shapes: Shape[];
}

const SHIELD = 'M12 3.4c-2.6 2-4.6 2.6-6.6 2.6v6c0 4.6 3.2 7 6.6 8.6 3.4-1.6 6.6-4 6.6-8.6V6c-2 0-4-.6-6.6-2.6z';
const BUILDING = [
  { t: 'path' as const, d: 'M4.6 20V9.4l6-3.4V20' },
  { t: 'path' as const, d: 'M10.6 12.4h6a1.6 1.6 0 0 1 1.6 1.6V20' },
  { t: 'path' as const, d: 'M3.4 20h17.2' },
];

const GLYPHS = {
  check: { stroke: 3.2, shapes: [{ t: 'path', d: 'M6 12.4l3.6 3.6L18 7.6' }] },
  arrowRight: {
    stroke: 2,
    shapes: [
      { t: 'path', d: 'M5 12h13' },
      { t: 'path', d: 'M13 7l5 5-5 5' },
    ],
  },
  chevronDown: { stroke: 2, shapes: [{ t: 'path', d: 'M7 10l5 4 5-4' }] },
  chevronLeft: { stroke: 2, shapes: [{ t: 'path', d: 'M15 6l-6 6 6 6' }] },
  calendar: {
    stroke: 1.8,
    shapes: [
      { t: 'rect', x: 4.4, y: 5.4, w: 15.2, h: 14.2, rx: 2 },
      { t: 'path', d: 'M4.4 9.6h15.2M9 3.6v3.4M15 3.6v3.4' },
    ],
  },
  info: {
    stroke: 1.8,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.4 },
      { t: 'path', d: 'M12 11v5.4M12 8.1h.01' },
    ],
  },
  alert: {
    stroke: 1.9,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.4 },
      { t: 'path', d: 'M12 8.2v4.6M12 15.6h.01' },
    ],
  },
  clock: {
    stroke: 1.8,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.2 },
      { t: 'path', d: 'M12 8.2V12l2.6 1.8' },
    ],
  },
  mail: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 3.4, y: 5.6, w: 17.2, h: 12.8, rx: 2.2 },
      { t: 'path', d: 'M3.8 7.4 12 13l8.2-5.6' },
    ],
  },
  idCard: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 3, y: 5.6, w: 18, h: 12.8, rx: 2.4 },
      { t: 'circle', cx: 9, cy: 11.4, r: 2.2 },
      { t: 'path', d: 'M14 10.4h4M14 13.4h2.6M5.6 16a3.6 3.6 0 0 1 6.8 0' },
    ],
  },
  shield: { stroke: 1.8, shapes: [{ t: 'path', d: SHIELD }] },
  shieldCheck: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: SHIELD },
      { t: 'path', d: 'M9.4 12.2l1.8 1.8 3.4-3.6' },
    ],
  },
  user: {
    stroke: 1.7,
    shapes: [
      { t: 'circle', cx: 12, cy: 9.2, r: 3.4 },
      { t: 'path', d: 'M5.6 19.6a6.4 6.4 0 0 1 12.8 0' },
    ],
  },
  userRound: {
    stroke: 1.8,
    shapes: [
      { t: 'circle', cx: 12, cy: 8.6, r: 3.4 },
      { t: 'path', d: 'M5.4 20a6.6 6.6 0 0 1 13.2 0' },
    ],
  },
  userKey: {
    stroke: 1.7,
    shapes: [
      { t: 'circle', cx: 10, cy: 9.6, r: 4.2 },
      { t: 'path', d: 'M10 13.8a5.6 5.6 0 0 0-5.6 5.6h7' },
      { t: 'path', d: 'M14.6 16.4a2.2 2.2 0 1 1 3.6 1.7v3.1l-1.4-1-1.4 1v-3.1a2.2 2.2 0 0 1-.8-1.7z' },
    ],
  },
  building: {
    stroke: 1.7,
    shapes: [...BUILDING, { t: 'path', d: 'M14.2 16.2h.8M14.2 18.6h.8' }],
  },
  buildingPlain: { stroke: 1.8, shapes: BUILDING },
  camera: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 3.6, y: 7, w: 16.8, h: 12.4, rx: 2.4 },
      { t: 'circle', cx: 12, cy: 13.2, r: 3.2 },
      { t: 'path', d: 'M8.6 7V5.4h6.8V7' },
    ],
  },
  lock: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 4.6, y: 10.4, w: 14.8, h: 9.6, rx: 2.2 },
      { t: 'path', d: 'M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6' },
    ],
  },
  phone: {
    stroke: 1.8,
    shapes: [
      {
        t: 'path',
        d: 'M7.6 3.6h8.8a1.8 1.8 0 0 1 1.8 1.8v13.2a1.8 1.8 0 0 1-1.8 1.8H7.6a1.8 1.8 0 0 1-1.8-1.8V5.4a1.8 1.8 0 0 1 1.8-1.8z',
      },
      { t: 'path', d: 'M11 17.8h2' },
    ],
  },
  message: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M4.4 6.6h15.2v10.8H4.4z' },
      { t: 'path', d: 'M8 10.4h8M8 13.4h4.6' },
    ],
  },
  copy: {
    stroke: 1.8,
    shapes: [
      { t: 'rect', x: 9, y: 9, w: 11, h: 11, rx: 2 },
      { t: 'path', d: 'M15 5.6H6a1.8 1.8 0 0 0-1.8 1.8v9' },
    ],
  },
  close: {
    stroke: 1.8,
    shapes: [{ t: 'path', d: 'M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6' }],
  },
  send: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M20 4.6 3.6 10.4l6.2 2.4 2.4 6.2z' },
      { t: 'path', d: 'M20 4.6 9.8 12.8' },
    ],
  },
  triangleAlert: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z' },
      { t: 'path', d: 'M12 8.2v4.6M12 15.6h.01' },
    ],
  },
  circleCheck: {
    stroke: 2,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.6 },
      { t: 'path', d: 'M8.4 12.2l2.6 2.6 4.6-5' },
    ],
  },
  circleX: {
    stroke: 2,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.6 },
      { t: 'path', d: 'M9 9l6 6M15 9l-6 6' },
    ],
  },
  listBullets: {
    stroke: 2,
    shapes: [
      { t: 'path', d: 'M9 6h11M9 12h11M9 18h11' },
      { t: 'circle', cx: 4.6, cy: 6, r: 1.1 },
      { t: 'circle', cx: 4.6, cy: 12, r: 1.1 },
      { t: 'circle', cx: 4.6, cy: 18, r: 1.1 },
    ],
  },
  listNumbers: {
    stroke: 2,
    shapes: [
      { t: 'path', d: 'M10 6h10M10 12h10M10 18h10' },
      { t: 'path', d: 'M4 5.2l1.4-1V8M3.8 11.2c.6-1 2.4-.9 2.4.3 0 1-2.4 1.8-2.4 3h2.6M3.8 16.6h2c.8 0 1.2.4 1.2 1s-.5 1-1.2 1c.7 0 1.4.4 1.4 1.1s-.6 1.1-1.4 1.1h-2' },
    ],
  },
  alignLeft: { stroke: 2, shapes: [{ t: 'path', d: 'M4 6h16M4 10h10M4 14h16M4 18h10' }] },
  alignCenter: { stroke: 2, shapes: [{ t: 'path', d: 'M4 6h16M7 10h10M4 14h16M7 18h10' }] },
  alignRight: { stroke: 2, shapes: [{ t: 'path', d: 'M4 6h16M10 10h10M4 14h16M10 18h10' }] },
  alignJustify: { stroke: 2, shapes: [{ t: 'path', d: 'M4 6h16M4 10h16M4 14h16M4 18h16' }] },
  indent: { stroke: 2, shapes: [{ t: 'path', d: 'M4 6h16M11 10h9M11 14h9M4 18h16M4 9.5l3 2.5-3 2.5' }] },
  outdent: { stroke: 2, shapes: [{ t: 'path', d: 'M4 6h16M11 10h9M11 14h9M4 18h16M7 9.5l-3 2.5 3 2.5' }] },
  quote: {
    stroke: 2,
    shapes: [{ t: 'path', d: 'M6 15.5c-1.6 0-2.5-1-2.5-2.6 0-2.2 1.6-4 3.8-4.9M6 15.5h2.4V11H6zM15 15.5c-1.6 0-2.5-1-2.5-2.6 0-2.2 1.6-4 3.8-4.9M15 15.5h2.4V11H15z' }],
  },
  table: {
    stroke: 1.9,
    shapes: [
      { t: 'rect', x: 3.4, y: 4.6, w: 17.2, h: 14.8, rx: 2 },
      { t: 'path', d: 'M3.4 10h17.2M3.4 14.6h17.2M10 4.6v14.8M15.4 4.6v14.8' },
    ],
  },
  undo: { stroke: 2, shapes: [{ t: 'path', d: 'M8.6 7.6L4.8 11.4l3.8 3.8M5 11.4h9.2a4.2 4.2 0 0 1 0 8.4H10' }] },
  redo: { stroke: 2, shapes: [{ t: 'path', d: 'M15.4 7.6l3.8 3.8-3.8 3.8M19 11.4H9.8a4.2 4.2 0 0 0 0 8.4H14' }] },
  textColor: { stroke: 2, shapes: [{ t: 'path', d: 'M6.6 16.4L12 4.6l5.4 11.8M8.6 12.4h6.8M4.6 20h14.8' }] },
  highlight: { stroke: 2, shapes: [{ t: 'path', d: 'M5.6 19.4h4.2M8 16.6l8.6-8.6a1.7 1.7 0 0 1 2.4 0l.6.6a1.7 1.7 0 0 1 0 2.4l-8.6 8.6H8z' }] },
  rowPlus: { stroke: 2, shapes: [{ t: 'rect', x: 3.4, y: 4.6, w: 17.2, h: 6.4, rx: 1.6 }, { t: 'path', d: 'M12 14.2v5.6M9.2 17h5.6' }] },
  columnPlus: { stroke: 2, shapes: [{ t: 'rect', x: 3.4, y: 3.4, w: 6.4, h: 17.2, rx: 1.6 }, { t: 'path', d: 'M16.6 9.2v5.6M13.8 12h5.6' }] },
  merge: { stroke: 2, shapes: [{ t: 'rect', x: 3.4, y: 5.4, w: 17.2, h: 13.2, rx: 1.8 }, { t: 'path', d: 'M9 12h6M13 10l2 2-2 2' }] },
  grip: {
    stroke: 1.8,
    shapes: [
      { t: 'circle', cx: 9.4, cy: 6.4, r: 1.1 },
      { t: 'circle', cx: 14.6, cy: 6.4, r: 1.1 },
      { t: 'circle', cx: 9.4, cy: 12, r: 1.1 },
      { t: 'circle', cx: 14.6, cy: 12, r: 1.1 },
      { t: 'circle', cx: 9.4, cy: 17.6, r: 1.1 },
      { t: 'circle', cx: 14.6, cy: 17.6, r: 1.1 },
    ],
  },
  pencil: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M16.4 4.6a2.3 2.3 0 0 1 3.2 3.2L8.4 19l-4.2 1 1-4.2z' },
      { t: 'path', d: 'M14.8 6.2l3 3' },
    ],
  },
  trash: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M4.6 6.6h14.8' },
      { t: 'path', d: 'M9.4 6.6V5a1.4 1.4 0 0 1 1.4-1.4h2.4A1.4 1.4 0 0 1 14.6 5v1.6' },
      { t: 'path', d: 'M6.6 6.6l.9 12a1.8 1.8 0 0 0 1.8 1.7h5.4a1.8 1.8 0 0 0 1.8-1.7l.9-12' },
    ],
  },
  folder: {
    stroke: 1.7,
    shapes: [
      {
        t: 'path',
        d: 'M3.6 7.4a2 2 0 0 1 2-2h3.4l2 2.4h7.4a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z',
      },
    ],
  },
  uploadCloud: {
    stroke: 1.7,
    shapes: [
      { t: 'path', d: 'M6.8 18.4A3.8 3.8 0 0 1 6.4 10.9a5.4 5.4 0 0 1 10.4-1.4 4.4 4.4 0 0 1 .6 8.7' },
      { t: 'path', d: 'M12 20.4v-8.2' },
      { t: 'path', d: 'M9.2 14.6 12 11.8l2.8 2.8' },
    ],
  },
  download: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M12 4.6v10.2' },
      { t: 'path', d: 'M8.2 11.4 12 15.2l3.8-3.8' },
      { t: 'path', d: 'M5 18.4h14' },
    ],
  },
  chain: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 3.6, y: 3.6, w: 7, h: 7, rx: 1.6 },
      { t: 'rect', x: 13.4, y: 3.6, w: 7, h: 7, rx: 1.6 },
      { t: 'rect', x: 3.6, y: 13.4, w: 7, h: 7, rx: 1.6 },
      { t: 'path', d: 'M13.4 13.4h7v7' },
    ],
  },
  externalLink: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M13.4 4.6h6v6' },
      { t: 'path', d: 'M19.4 4.6 11 13' },
      {
        t: 'path',
        d: 'M17.6 14v4.4a1.8 1.8 0 0 1-1.8 1.8H5.6a1.8 1.8 0 0 1-1.8-1.8V8.2a1.8 1.8 0 0 1 1.8-1.8H10',
      },
    ],
  },
  note: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 3.6, y: 5.6, w: 16.8, h: 12.8, rx: 2 },
      { t: 'path', d: 'M7.4 12h9.2' },
    ],
  },
  checkAll: {
    stroke: 1.9,
    shapes: [
      { t: 'path', d: 'M4.6 12.4l3.4 3.4 11.4-11.4' },
      { t: 'path', d: 'M4.6 18.8h14.8' },
    ],
  },
  archive: {
    stroke: 1.8,
    shapes: [
      { t: 'rect', x: 3.6, y: 4.2, w: 16.8, h: 4, rx: 1.4 },
      { t: 'path', d: 'M5.2 8.2h13.6v10.2a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2z' },
      { t: 'path', d: 'M9.8 12.6h4.4' },
    ],
  },
  play: { stroke: 2, shapes: [{ t: 'path', d: 'M7 5v14l11-7z' }] },
  stop: {
    stroke: 1.8,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.4 },
      { t: 'path', d: 'M9 12h6' },
    ],
  },
  docCheck: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M12 20.4H6.4a1.8 1.8 0 0 1-1.8-1.8V5.4a1.8 1.8 0 0 1 1.8-1.8h11.2a1.8 1.8 0 0 1 1.8 1.8V12' },
      { t: 'path', d: 'M8.4 8h7M8.4 11.6h4' },
      { t: 'path', d: 'M14.6 18.6l2.2 2.2 4-4.4' },
    ],
  },
  eye: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z' },
      { t: 'circle', cx: 12, cy: 12, r: 2.9 },
    ],
  },
  filter: { stroke: 1.8, shapes: [{ t: 'path', d: 'M5 7.5h14M8 12h8M10.5 16.5h3' }] },
  sign: {
    stroke: 1.9,
    shapes: [
      { t: 'path', d: 'M15.4 5.4 18.6 8.6' },
      {
        t: 'path',
        d: 'M4.2 19.8l1.1-4.2L16 4.9a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L8.4 18.7z',
      },
    ],
  },
  plus: { stroke: 2.1, shapes: [{ t: 'path', d: 'M12 5.6v12.8M5.6 12h12.8' }] },
  bell: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M6.4 10.4a5.6 5.6 0 0 1 11.2 0c0 4 1.6 5.6 1.6 5.6H4.8s1.6-1.6 1.6-5.6z' },
      { t: 'path', d: 'M10.2 19a2 2 0 0 0 3.6 0' },
    ],
  },
  help: {
    stroke: 1.8,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.2 },
      { t: 'path', d: 'M9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1 1-1.1 1.8' },
      { t: 'path', d: 'M12 16.6h.01' },
    ],
  },
  globe: {
    stroke: 1.8,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 8.2 },
      { t: 'path', d: 'M3.8 12h16.4' },
      { t: 'path', d: 'M12 3.8a12.6 12.6 0 0 1 0 16.4 12.6 12.6 0 0 1 0-16.4z' },
    ],
  },
  lines: {
    stroke: 2.2,
    shapes: [
      { t: 'rect', x: 3.4, y: 4.6, w: 17.2, h: 14.8, rx: 2 },
      { t: 'path', d: 'M7 9h6M7 12.4h9M7 15.8h4' },
    ],
  },
  screen: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M4.6 6.6h14.8v10.8H4.6z' },
      { t: 'path', d: 'M14 17.4v2M11.4 19.4h5.2' },
    ],
  },
  rotate: {
    stroke: 1.8,
    shapes: [{ t: 'path', d: 'M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4' }],
  },
  landscape: {
    stroke: 1.8,
    shapes: [{ t: 'rect', x: 2.6, y: 6.6, w: 18.8, h: 10.8, rx: 2.2 }],
  },
  phoneTurn: {
    stroke: 1.8,
    shapes: [
      { t: 'rect', x: 2.6, y: 6.6, w: 18.8, h: 10.8, rx: 2.2 },
      { t: 'path', d: 'M8 21h8M12 17.4V21' },
    ],
  },
  brightness: {
    stroke: 1.9,
    shapes: [
      {
        t: 'path',
        d: 'M12 4.2v2M6 6.4l1.4 1.4M18 6.4l-1.4 1.4M4 12.4h2M18 12.4h2M12 9.6a3.4 3.4 0 0 1 2 6.2v1.4h-4v-1.4a3.4 3.4 0 0 1 2-6.2z',
      },
    ],
  },
  collapse: {
    stroke: 1.7,
    shapes: [
      { t: 'path', d: 'M14.5 7 9.5 12l5 5' },
      { t: 'path', d: 'M19.5 5.2v13.6' },
    ],
  },
  search: {
    stroke: 1.9,
    shapes: [
      { t: 'circle', cx: 10.8, cy: 10.8, r: 6.4 },
      { t: 'path', d: 'M20 20l-4.6-4.6' },
    ],
  },
  chevronRight: { stroke: 2, shapes: [{ t: 'path', d: 'M9 6l6 6-6 6' }] },
  chevronUpDown: { stroke: 2, shapes: [{ t: 'path', d: 'M8 14l4 4 4-4M8 10l4-4 4 4' }] },
  dashboard: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 3.4, y: 3.4, w: 7.6, h: 7.6, rx: 2.2 },
      { t: 'rect', x: 13, y: 3.4, w: 7.6, h: 7.6, rx: 2.2, fill: 'var(--db-primary-ink)' },
      { t: 'rect', x: 3.4, y: 13, w: 7.6, h: 7.6, rx: 2.2 },
      { t: 'rect', x: 13, y: 13, w: 7.6, h: 7.6, rx: 2.2 },
    ],
  },
  documents: {
    stroke: 1.7,
    shapes: [
      {
        t: 'path',
        d: 'M7 4.6a1.6 1.6 0 0 1 1.6-1.6h5L18.4 7.8v11.6A1.6 1.6 0 0 1 16.8 21H8.6A1.6 1.6 0 0 1 7 19.4z',
      },
      { t: 'path', d: 'M13.4 3v4.8h5' },
      { t: 'path', d: 'M10 13.4h5.2M10 16.6h3.4' },
    ],
  },
  blocks: {
    stroke: 1.7,
    shapes: [
      { t: 'path', d: 'M12 3.1 20 7.5v9L12 20.9 4 16.5v-9z' },
      { t: 'path', d: 'M4 7.5 12 12l8-4.5' },
      { t: 'path', d: 'M12 12v8.9' },
    ],
  },
  processes: {
    stroke: 1.7,
    shapes: [
      { t: 'circle', cx: 6.4, cy: 11.6, r: 2.6 },
      { t: 'circle', cx: 17.6, cy: 6.8, r: 2.6 },
      { t: 'circle', cx: 17.6, cy: 17.4, r: 2.6 },
      { t: 'path', d: 'M8.8 10.6 15.2 7.8M8.8 12.8l6.4 3.6' },
    ],
  },
  flows: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 9.2, y: 3.2, w: 5.6, h: 4.4, rx: 1.5 },
      { t: 'rect', x: 3.4, y: 16.4, w: 5.6, h: 4.4, rx: 1.5 },
      { t: 'rect', x: 15, y: 16.4, w: 5.6, h: 4.4, rx: 1.5 },
      { t: 'path', d: 'M12 7.6v3.8M12 11.4H6.2v5M12 11.4h5.8v5' },
    ],
  },
  templates: {
    stroke: 1.7,
    shapes: [
      { t: 'rect', x: 8, y: 3.2, w: 12.4, h: 15, rx: 2.4 },
      { t: 'path', d: 'M15.6 20.8H6.6A2.4 2.4 0 0 1 4.2 18.4V7.6' },
    ],
  },
  signers: {
    stroke: 1.7,
    shapes: [
      { t: 'circle', cx: 9.4, cy: 8.4, r: 3.2 },
      { t: 'path', d: 'M4 19.6a5.4 5.4 0 0 1 10.8 0' },
      { t: 'path', d: 'M16.4 5.6a3.2 3.2 0 0 1 0 5.6M18.2 19.6a5.4 5.4 0 0 0-2.4-4.4' },
    ],
  },
  reports: {
    stroke: 1.7,
    shapes: [
      { t: 'path', d: 'M4.4 20.4h15.2' },
      { t: 'rect', x: 6, y: 11.4, w: 3.4, h: 6.6, rx: 1.1 },
      { t: 'rect', x: 10.8, y: 6.6, w: 3.4, h: 11.4, rx: 1.1 },
      { t: 'rect', x: 15.6, y: 14, w: 3.4, h: 4, rx: 1.1 },
    ],
  },
  settings: {
    stroke: 1.7,
    shapes: [
      { t: 'path', d: 'M12 15.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2z' },
      {
        t: 'path',
        d: 'M19.3 14.2a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6H4.1a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4V4.1a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9z',
      },
    ],
  },
  market: {
    stroke: 1.8,
    shapes: [
      { t: 'path', d: 'M4.6 8.4h14.8l-1.2 10.2a1.6 1.6 0 0 1-1.6 1.4H7.4a1.6 1.6 0 0 1-1.6-1.4z' },
      { t: 'path', d: 'M9 8.4V6.6a3 3 0 0 1 6 0v1.8' },
    ],
  },
  support: {
    stroke: 1.7,
    shapes: [
      { t: 'path', d: 'M4.6 13.2v-1.4a7.4 7.4 0 0 1 14.8 0v1.4' },
      {
        t: 'path',
        d: 'M4.6 13.2a1.9 1.9 0 0 1 1.9-1.9h.9v5.6h-.9a1.9 1.9 0 0 1-1.9-1.9zM19.4 13.2a1.9 1.9 0 0 0-1.9-1.9h-.9v5.6h.9a1.9 1.9 0 0 0 1.9-1.9z',
      },
      { t: 'path', d: 'M19.4 15.6v.9a3.4 3.4 0 0 1-3.4 3.4h-2.9' },
    ],
  },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof GLYPHS;
export const GLYPH_NAMES = Object.keys(GLYPHS) as IconName[];

@Component({
  selector: 'db-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
      aria-hidden="true"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.stroke-width]="glyph().stroke"
    >
      @for (shape of glyph().shapes; track $index) {
        @if (shape.t === 'path') {
          <svg:path
            [attr.d]="shape.d"
            [attr.fill]="shape.fill"
            [attr.stroke]="shape.fill ? 'none' : null"
          />
        } @else if (shape.t === 'circle') {
          <svg:circle
            [attr.cx]="shape.cx"
            [attr.cy]="shape.cy"
            [attr.r]="shape.r"
            [attr.fill]="shape.fill"
            [attr.stroke]="shape.fill ? 'none' : null"
          />
        } @else {
          <svg:rect
            [attr.x]="shape.x"
            [attr.y]="shape.y"
            [attr.width]="shape.w"
            [attr.height]="shape.h"
            [attr.rx]="shape.rx"
            [attr.fill]="shape.fill"
            [attr.stroke]="shape.fill ? 'none' : null"
          />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      line-height: 0;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(16);

  protected readonly glyph = computed<Glyph>(() => GLYPHS[this.name()]);
}
