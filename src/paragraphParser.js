/**
 * Convert raw WordprocessingML paragraphs into normalised `ParsedParagraph`
 * records. A `ParsedParagraph` is the lingua franca passed downstream to
 * `cardHeuristics.detectLevel` and `cardAssembler`.
 *
 * @typedef {Object} ParsedSegment
 * @property {string}  text
 * @property {boolean} highlighted
 *
 * @typedef {Object} ParsedParagraph
 * @property {string|null}   styleId        Raw Word paragraph style id, if any.
 * @property {string}        text           Whitespace-collapsed concatenation of all runs.
 * @property {ParsedSegment[]} segments     Per-run text with highlight metadata.
 * @property {number}        boldRatio      bolded chars / total chars (0 if no text).
 * @property {number}        largeTextRatio chars at tag-font size or larger / total chars.
 * @property {number|null}   maxFontSize    Largest half-point font size observed.
 * @property {boolean}       hasHighlight
 * @property {boolean}       hasRed
 */

const { W, ATTR, asArray } = require('./wordXmlConstants');
const { pushSegment, escapeWhitespace, normalizePlainText } = require('./textUtils');
const { DEFAULT_OPTIONS } = require('./options');

function parseFontSize(value) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Word boolean properties can be present as `<w:b/>` (truthy) or
 * `<w:b w:val="0"/>` (falsy). This handles both forms.
 */
function hasFlagValue(node) {
  if (node === undefined || node === null) {
    return false;
  }
  if (typeof node !== 'object') {
    return true;
  }
  const val = node[ATTR.VALUE];
  if (val === undefined) {
    return true;
  }
  const normalized = String(val).toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}

function isBold(runPr, defaultPr) {
  return hasFlagValue(runPr?.[W.BOLD]) || hasFlagValue(defaultPr?.[W.BOLD]);
}

function getFontSize(runPr, defaultPr) {
  return (
    parseFontSize(runPr?.[W.SIZE]?.[ATTR.VALUE]) ||
    parseFontSize(defaultPr?.[W.SIZE]?.[ATTR.VALUE]) ||
    null
  );
}

function hasHighlight(runPr) {
  const highlightVal = runPr?.[W.HIGHLIGHT]?.[ATTR.VALUE];
  if (highlightVal && !['none', 'white', 'auto'].includes(highlightVal.toLowerCase())) {
    return true;
  }
  const shdFill = runPr?.[W.SHADING]?.[ATTR.FILL];
  if (shdFill && !['auto', 'ffffff', '000000'].includes(shdFill.toLowerCase())) {
    return true;
  }
  return false;
}

function hasRed(runPr, defaultPr) {
  const colorVal = runPr?.[W.COLOR]?.[ATTR.VALUE] || defaultPr?.[W.COLOR]?.[ATTR.VALUE];
  if (!colorVal) {
    return false;
  }
  const normalized = String(colorVal).toLowerCase();
  return normalized === 'ff0000' || normalized === 'red';
}

/**
 * Pull the visible text out of a single `<w:r>` element, including any tab
 * and break placeholders. NBSPs are normalised to regular spaces.
 */
function extractRunText(run) {
  let text = '';
  const textNodes = asArray(run?.[W.TEXT]);
  for (const node of textNodes) {
    if (typeof node === 'string') {
      text += node;
    } else if (node && typeof node === 'object' && typeof node['#text'] === 'string') {
      text += node['#text'];
    }
  }

  const tabs = asArray(run?.[W.TAB]);
  if (tabs.length) {
    text += '\t'.repeat(tabs.length);
  }

  const breaks = asArray(run?.[W.BREAK]);
  if (breaks.length) {
    text += '\n'.repeat(breaks.length);
  }

  return escapeWhitespace(text);
}

/**
 * Convert one `<w:p>` element into a `ParsedParagraph`.
 *
 * @param {object} paragraph - Raw fast-xml-parser node for `<w:p>`.
 * @param {import('./options').ParseDocxOptions} [options]
 * @returns {ParsedParagraph}
 */
function parseParagraph(paragraph, options = DEFAULT_OPTIONS) {
  const pPr = paragraph?.[W.PARAGRAPH_PROPS] || {};
  const styleId = pPr?.[W.STYLE]?.[ATTR.VALUE] || null;
  const defaultPr = pPr?.[W.RUN_PROPS] || {};
  const runs = asArray(paragraph?.[W.RUN]);

  let totalLength = 0;
  let boldLength = 0;
  let atLeastTagFontLength = 0;
  let maxFontSize = null;
  const segments = [];
  let paragraphHasHighlight = false;
  let paragraphHasRed = false;

  for (const run of runs) {
    const runPr = run?.[W.RUN_PROPS] || {};
    const runText = extractRunText(run);
    if (!runText) {
      continue;
    }

    const runFontSize = getFontSize(runPr, defaultPr);
    if (runFontSize) {
      maxFontSize = Math.max(maxFontSize ?? 0, runFontSize);
      if (runFontSize >= options.tagFontSizeMin) {
        atLeastTagFontLength += runText.length;
      }
    }

    const runBold = isBold(runPr, defaultPr);
    const runHighlight = hasHighlight(runPr);
    if (runHighlight) {
      paragraphHasHighlight = true;
    }
    if (hasRed(runPr, defaultPr)) {
      paragraphHasRed = true;
    }

    totalLength += runText.length;
    if (runBold) {
      boldLength += runText.length;
    }

    pushSegment(segments, runText, runHighlight);
  }

  const plainText = normalizePlainText(segments.map((segment) => segment.text).join(''));
  const boldRatio = totalLength > 0 ? boldLength / totalLength : 0;
  const largeTextRatio = totalLength > 0 ? atLeastTagFontLength / totalLength : 0;

  return {
    styleId,
    text: plainText,
    segments,
    boldRatio,
    largeTextRatio,
    maxFontSize,
    hasHighlight: paragraphHasHighlight,
    hasRed: paragraphHasRed,
  };
}

/**
 * Convenience: turn a parsed `word/document.xml` into the list of non-empty
 * `ParsedParagraph`s in document order.
 *
 * @param {object} documentData
 * @param {import('./options').ParseDocxOptions} options
 * @returns {ParsedParagraph[]}
 */
function extractParagraphsFromDocument(documentData, options) {
  return asArray(documentData?.[W.DOCUMENT]?.[W.BODY]?.[W.PARAGRAPH])
    .map((paragraph) => parseParagraph(paragraph, options))
    .filter((paragraph) => Boolean(paragraph.text));
}

module.exports = {
  parseParagraph,
  extractParagraphsFromDocument,
};
