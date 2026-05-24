/**
 * Constants for the WordprocessingML schema we parse out of `.docx` files.
 *
 * fast-xml-parser is configured to emit elements with prefix `w:` and to keep
 * attributes under `@_<name>`, so consumers read e.g. `runPr['w:sz']?.['@_w:val']`.
 *
 * Hardcoding these in one place means a future schema migration (or porting
 * to a different XML parser) touches a single file.
 */

const W = {
  PARAGRAPH: 'w:p',
  RUN: 'w:r',
  TEXT: 'w:t',
  TAB: 'w:tab',
  BREAK: 'w:br',
  PARAGRAPH_PROPS: 'w:pPr',
  RUN_PROPS: 'w:rPr',
  STYLE: 'w:pStyle',
  BOLD: 'w:b',
  SIZE: 'w:sz',
  HIGHLIGHT: 'w:highlight',
  SHADING: 'w:shd',
  COLOR: 'w:color',
  DOCUMENT: 'w:document',
  BODY: 'w:body',
};

const ATTR = {
  VALUE: '@_w:val',
  FILL: '@_w:fill',
};

/**
 * Elements that fast-xml-parser should always emit as arrays, even when only
 * one instance is present. Without this, a paragraph with a single run is
 * indistinguishable from a single text node.
 */
const ARRAY_ELEMENTS = [W.PARAGRAPH, W.RUN, W.TEXT, W.BREAK, W.TAB];

/**
 * Word paragraph styles we map directly to card-tree levels, bypassing
 * font-size heuristics. Keys are lowercase, whitespace-stripped style IDs
 * (Word stores them as `Heading 1`, `Heading1`, etc.).
 */
const HEADING_STYLE_MAP = Object.freeze({
  heading1: 'pocket',
  heading2: 'hat',
  heading3: 'block',
  heading4: 'tag',
});

/**
 * Wrap a value as an array. Used to normalise XMLParser output where a single
 * child element appears as an object and multiple children appear as an array.
 *
 * @param {*} value
 * @returns {Array}
 */
function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

module.exports = {
  W,
  ATTR,
  ARRAY_ELEMENTS,
  HEADING_STYLE_MAP,
  asArray,
};
