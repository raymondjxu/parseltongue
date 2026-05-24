/**
 * Tunable parameters for the DOCX → card-tree heuristics.
 *
 * Word stores font sizes as half-points, so a tag font of "16pt" is `32`.
 * The defaults match common debate-evidence formatting: pocket headers in
 * 26pt+ (≥52 half-points), block titles ~16pt, body text around 11pt.
 *
 * @typedef {Object} ParseDocxOptions
 * @property {number} pocketFontSizeMin           Min half-points to treat as a pocket heading.
 * @property {number} hatFontSizeMin              Min half-points to treat as a hat heading.
 * @property {number} blockFontSizeMin            Min half-points to treat as a block heading.
 * @property {number} tagFontSizeMin              Lower bound of half-points considered "tag-sized".
 * @property {number} tagFontSizeMax              Upper bound of half-points considered "tag-sized" (avoids
 *                                                misclassifying block titles as tags).
 * @property {number} maxTagLength                Tag candidates longer than this many chars are rejected
 *                                                (long bold lines tend to be body copy, not headings).
 * @property {number} boldRatioThreshold          Fraction of a paragraph's chars that must be bold for it
 *                                                to be considered "boldly emphasised". Conservative default
 *                                                so that lightly-emphasised body text isn't flagged.
 * @property {number} heuristicTagBoldRatioMin    Stricter bold ratio used by the fallback tag-detection
 *                                                heuristic (when no heading style is present).
 * @property {number} heuristicTagLargeTextRatioMin
 *                                                Fraction of chars that must be at tag-font size for the
 *                                                fallback heuristic to fire.
 * @property {number} shortUrlCiteMaxLength       Paragraphs at or below this length containing a URL are
 *                                                treated as standalone cites.
 * @property {number} maxCiteParagraphs           Number of paragraphs we'll buffer while waiting for a cite
 *                                                after a tag before giving up and folding them into card text.
 * @property {string} defaultPocketTitle          Placeholder for unnamed pockets.
 * @property {string} defaultHatTitle             Placeholder for unnamed hats.
 * @property {string} defaultBlockTitle           Placeholder for unnamed blocks.
 */

/** @type {ParseDocxOptions} */
const DEFAULT_OPTIONS = Object.freeze({
  pocketFontSizeMin: 52,
  hatFontSizeMin: 44,
  blockFontSizeMin: 32,
  tagFontSizeMin: 26,
  tagFontSizeMax: 30,
  maxTagLength: 400,
  boldRatioThreshold: 0.55,
  heuristicTagBoldRatioMin: 0.6,
  heuristicTagLargeTextRatioMin: 0.9,
  shortUrlCiteMaxLength: 120,
  maxCiteParagraphs: 3,
  defaultPocketTitle: 'Untitled Pocket',
  defaultHatTitle: 'Untitled Hat',
  defaultBlockTitle: 'Untitled Block',
});

/**
 * Merge user-supplied options over DEFAULT_OPTIONS.
 * Returns a fresh object — DEFAULT_OPTIONS itself is frozen.
 *
 * @param {Partial<ParseDocxOptions>} [user]
 * @returns {ParseDocxOptions}
 */
function mergeOptions(user = {}) {
  return { ...DEFAULT_OPTIONS, ...user };
}

module.exports = {
  DEFAULT_OPTIONS,
  mergeOptions,
};
