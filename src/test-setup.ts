const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;

if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect ??= rect as unknown as () => DOMRect;
  Range.prototype.getClientRects ??= rects;
}
if (typeof document !== 'undefined') {
  document.elementFromPoint ??= () => null;
}
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView ??= () => undefined;
}
