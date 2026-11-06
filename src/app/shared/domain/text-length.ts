const PRESENTATION_SEQUENCES = /[^️︎][️︎]/g;
const SURROGATE_PAIRS = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

export const textLength = (text: string): number =>
  text.length -
  (text.match(PRESENTATION_SEQUENCES)?.length ?? 0) -
  (text.match(SURROGATE_PAIRS)?.length ?? 0);
