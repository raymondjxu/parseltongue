/**
 * Text and segment manipulation helpers shared between paragraphParser,
 * cardHeuristics, and cardAssembler.
 *
 * A "segment" is `{ text: string, highlighted: boolean }`.
 */

/**
 * U+00A0 NON-BREAKING SPACE. Word emits these heavily.
 *
 * Constructed via `String.fromCharCode` rather than written as a literal so
 * the source stays pure ASCII — NBSP renders identically to ' ' in most
 * editors, which makes literal occurrences impossible to review safely.
 */
const NBSP = String.fromCharCode(0xa0);
const NBSP_RE = new RegExp(NBSP, 'g');

/**
 * Collapse runs of whitespace to single spaces and trim ends.
 */
function normalizePlainText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Replace non-breaking spaces with regular spaces so downstream string
 * comparisons aren't surprised.
 */
function escapeWhitespace(text) {
  return text.replace(NBSP_RE, ' ');
}

/**
 * Append a segment, merging into the previous one if highlight state matches.
 * In-place mutation.
 */
function pushSegment(segments, text, highlighted) {
  if (!text) {
    return;
  }
  const last = segments[segments.length - 1];
  if (last && last.highlighted === highlighted) {
    last.text += text;
    return;
  }
  segments.push({ text, highlighted });
}

/**
 * Collapse whitespace within and across segments, drop empties, trim ends.
 * Preserves the highlight property of each segment.
 */
function normalizeSegments(segments) {
  const cleaned = [];
  for (const segment of segments) {
    let text = segment.text.replace(/\s+/g, ' ');
    if (!text) {
      continue;
    }
    if (!cleaned.length) {
      pushSegment(cleaned, text, segment.highlighted);
      continue;
    }

    const previous = cleaned[cleaned.length - 1];
    const previousEndsSpace = /\s$/.test(previous.text);
    const currentStartsSpace = /^\s/.test(text);

    if (previousEndsSpace) {
      text = text.replace(/^\s+/, '');
    } else if (currentStartsSpace) {
      text = text.replace(/^\s+/, ' ');
    }

    if (!text) {
      continue;
    }

    pushSegment(cleaned, text, segment.highlighted);
  }
  if (!cleaned.length) {
    return cleaned;
  }
  cleaned[0].text = cleaned[0].text.replace(/^\s+/, '');
  cleaned[cleaned.length - 1].text = cleaned[cleaned.length - 1].text.replace(/\s+$/, '');
  return cleaned.filter((segment) => segment.text.length > 0);
}

module.exports = {
  NBSP,
  normalizePlainText,
  escapeWhitespace,
  pushSegment,
  normalizeSegments,
};
