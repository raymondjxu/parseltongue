/**
 * Pure-function heuristics for classifying a `ParsedParagraph` into a
 * card-tree level (`pocket | hat | block | tag | null`) and recognising
 * cite text. No DOCX I/O, no state — every function is `(input, options) → output`
 * and individually unit-testable.
 */

const { HEADING_STYLE_MAP } = require('./wordXmlConstants');
const { normalizePlainText } = require('./textUtils');
const { DEFAULT_OPTIONS } = require('./options');

function normalizeStyleId(styleId) {
  if (!styleId) {
    return null;
  }
  return styleId.toLowerCase().replace(/\s+/g, '');
}

/**
 * True if the text contains anything that looks like a URL or domain-with-path.
 */
function containsUrlLikeToken(text) {
  if (!text) {
    return false;
  }
  return (
    /https?:\/\//i.test(text) ||
    /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[\w%./?=#&+-]*/i.test(text)
  );
}

/**
 * Classify a paragraph into a card-tree level using:
 *   1. Word heading style ids (most reliable)
 *   2. Font-size + bold heuristics
 *   3. Fallback size-only heuristic when the document lacks bold metadata
 *
 * @param {import('./paragraphParser').ParsedParagraph} paragraph
 * @param {import('./options').ParseDocxOptions} options
 * @param {{ hasStrongBoldSignal?: boolean }} [context]
 * @returns {'pocket'|'hat'|'block'|'tag'|null}
 */
function detectLevel(paragraph, options, context = {}) {
  const normalizedStyle = normalizeStyleId(paragraph.styleId);
  const withinTagLength =
    !Number.isFinite(options.maxTagLength) ||
    options.maxTagLength <= 0 ||
    paragraph.text.length <= options.maxTagLength;

  if (normalizedStyle && HEADING_STYLE_MAP[normalizedStyle]) {
    const mappedLevel = HEADING_STYLE_MAP[normalizedStyle];
    if (mappedLevel !== 'tag' || withinTagLength) {
      return mappedLevel;
    }
    return null;
  }

  const fontSize = paragraph.maxFontSize;
  const boldLikely = paragraph.boldRatio >= options.boldRatioThreshold;
  if (fontSize && boldLikely) {
    if (fontSize >= options.pocketFontSizeMin) return 'pocket';
    if (fontSize >= options.hatFontSizeMin) return 'hat';
    if (fontSize >= options.blockFontSizeMin) return 'block';
    if (
      fontSize >= options.tagFontSizeMin &&
      fontSize <= options.tagFontSizeMax &&
      withinTagLength
    ) {
      return 'tag';
    }
  }

  if (!fontSize) {
    return null;
  }

  const heuristicallyTagSized = paragraph.largeTextRatio >= options.heuristicTagLargeTextRatioMin;

  // Some docs omit bold metadata completely. Fall back to size tiers only.
  if (
    context.hasStrongBoldSignal === false &&
    heuristicallyTagSized &&
    !containsUrlLikeToken(paragraph.text)
  ) {
    if (fontSize >= options.pocketFontSizeMin) return 'pocket';
    if (fontSize >= options.hatFontSizeMin) return 'hat';
    if (fontSize >= options.blockFontSizeMin) return 'block';
    if (
      fontSize >= options.tagFontSizeMin &&
      fontSize <= options.tagFontSizeMax &&
      withinTagLength
    ) {
      return 'tag';
    }
  }

  const heuristicallyTagBold = paragraph.boldRatio >= options.heuristicTagBoldRatioMin;
  if (
    heuristicallyTagBold &&
    heuristicallyTagSized &&
    !containsUrlLikeToken(paragraph.text) &&
    fontSize >= options.tagFontSizeMin &&
    withinTagLength
  ) {
    return 'tag';
  }

  return null;
}

function isCiteLine(text, options = DEFAULT_OPTIONS) {
  if (!text) {
    return false;
  }
  const normalized = normalizePlainText(text);
  if (normalized.length <= options.shortUrlCiteMaxLength && containsUrlLikeToken(normalized)) {
    return true;
  }
  return (
    /https?:\/\//i.test(normalized) || /\bpdf\b/i.test(normalized) || normalized.includes('//')
  );
}

function isCiteContinuation(text) {
  if (!text) {
    return false;
  }
  if (/https?:\/\//i.test(text)) return true;
  if (/\b(accessed|date accessed|retrieved)\b/i.test(text)) return true;
  if (text.includes('//')) return true;
  return /\/[A-Za-z0-9]/.test(text) && text.length < 200;
}

function joinCiteFragments(previous, next) {
  if (!previous) return normalizePlainText(next);
  if (!next) return normalizePlainText(previous);
  const trimmedPrevious = normalizePlainText(previous);
  const trimmedNext = normalizePlainText(next);
  const looksLikeUrlContinuation =
    /[A-Za-z0-9]$/.test(trimmedPrevious) &&
    /^[A-Za-z0-9]/.test(trimmedNext) &&
    /\/[A-Za-z0-9]/.test(trimmedNext);
  if (looksLikeUrlContinuation) {
    return `${trimmedPrevious}${trimmedNext}`;
  }
  return `${trimmedPrevious} ${trimmedNext}`;
}

function joinCiteLines(lines) {
  return lines.reduce((acc, line) => joinCiteFragments(acc, line), '');
}

function joinTagFragments(previous, next) {
  if (!previous) return normalizePlainText(next);
  if (!next) return normalizePlainText(previous);
  return `${normalizePlainText(previous)} ${normalizePlainText(next)}`;
}

module.exports = {
  normalizeStyleId,
  containsUrlLikeToken,
  detectLevel,
  isCiteLine,
  isCiteContinuation,
  joinCiteFragments,
  joinCiteLines,
  joinTagFragments,
};
