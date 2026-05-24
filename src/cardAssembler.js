/**
 * Stateful walker that consumes `ParsedParagraph`s in document order and
 * builds the pocket → hat → block → card tree.
 *
 * Owning the state in a class (vs. closure variables in a long function)
 * makes the transitions explicit and lets each branch be unit-tested by
 * feeding synthetic paragraphs directly to `consume()`, no DOCX needed.
 */

const { normalizeSegments, pushSegment } = require('./textUtils');
const {
  detectLevel,
  isCiteLine,
  isCiteContinuation,
  joinCiteFragments,
  joinCiteLines,
  joinTagFragments,
} = require('./cardHeuristics');

function appendCardText(card, segments, hasRedText = false) {
  const cleanedSegments = normalizeSegments(segments);
  if (!cleanedSegments.length) {
    return;
  }
  if (hasRedText) {
    card.red = true;
  }
  if (card.cardTextSegments.length) {
    pushSegment(card.cardTextSegments, ' ', false);
  }
  for (const segment of cleanedSegments) {
    pushSegment(card.cardTextSegments, segment.text, segment.highlighted);
  }
}

function markMissingCite(card, warnings) {
  if (!card || card.missingCite) {
    return;
  }
  card.missingCite = true;
  warnings.push(`Missing cite for tag: ${card.tag}`);
}

class CardAssembler {
  /**
   * @param {import('./options').ParseDocxOptions} options
   * @param {{ hasStrongBoldSignal: boolean }} context
   *   Pre-computed signal about the document as a whole. The level heuristic
   *   falls back to a size-only path when bold metadata is missing globally.
   */
  constructor(options, context) {
    this.options = options;
    this.context = context;
    this.root = { type: 'file', children: [] };
    this.warnings = [];

    this.currentPocket = null;
    this.currentHat = null;
    this.currentBlock = null;
    this.currentCard = null;

    this.pendingCite = false;
    this.citeBuffer = [];
    this.citeContinuationRemaining = 0;
  }

  /**
   * Feed a single `ParsedParagraph`. Order matters: paragraphs must arrive
   * in document order.
   */
  consume(parsed) {
    // 1. A buffered tag is waiting on its cite, and this paragraph looks like a cite.
    if (this.currentCard && this.pendingCite && isCiteLine(parsed.text, this.options)) {
      const citeLines = [...this.citeBuffer.map((entry) => entry.text), parsed.text];
      this.currentCard.cite = joinCiteLines(citeLines);
      this._resetCiteState(this.options.maxCiteParagraphs);
      return;
    }

    // 2. Heading-level paragraph — pockets/hats/blocks reset the tree below them.
    const level = detectLevel(parsed, this.options, this.context);
    if (level === 'pocket') {
      this._finalizePending();
      this.currentPocket = { type: 'pocket', title: parsed.text, children: [] };
      this.root.children.push(this.currentPocket);
      this.currentHat = null;
      this.currentBlock = null;
      this.currentCard = null;
      this._resetCiteState(0);
      return;
    }

    if (level === 'hat') {
      this._finalizePending();
      const pocket = this._ensurePocket();
      this.currentHat = { type: 'hat', title: parsed.text, children: [] };
      pocket.children.push(this.currentHat);
      this.currentBlock = null;
      this.currentCard = null;
      this._resetCiteState(0);
      return;
    }

    if (level === 'block') {
      this._finalizePending();
      const hat = this._ensureHat();
      this.currentBlock = { type: 'block', title: parsed.text, children: [] };
      hat.children.push(this.currentBlock);
      this.currentCard = null;
      this._resetCiteState(0);
      return;
    }

    if (level === 'tag') {
      // Special case: a second tag-styled paragraph arriving immediately after
      // a tag (before any cite or body text) is treated as a continuation of
      // the tag, not a new card.
      if (
        this.currentCard &&
        this.pendingCite &&
        !this.currentCard.cite &&
        this.currentCard.cardTextSegments.length === 0 &&
        this.citeBuffer.length === 0
      ) {
        this.currentCard.tag = joinTagFragments(this.currentCard.tag, parsed.text);
        return;
      }

      this._finalizePending();
      const card = {
        type: 'card',
        tag: parsed.text,
        cite: '',
        cardTextSegments: [],
        red: false,
        missingCite: false,
      };
      this._getCardContainer().children.push(card);
      this.currentCard = card;
      this.pendingCite = true;
      this.citeBuffer = [];
      this.citeContinuationRemaining = 0;
      return;
    }

    // 3. Body-text paragraph. Without an active card it's ignored (pre-card preamble).
    if (!this.currentCard) {
      return;
    }

    // 3a. Still buffering for the missing cite — store and bail out (with overflow).
    if (this.pendingCite) {
      this.citeBuffer.push(parsed);
      if (this.citeBuffer.length >= this.options.maxCiteParagraphs) {
        markMissingCite(this.currentCard, this.warnings);
        for (const entry of this.citeBuffer) {
          appendCardText(this.currentCard, entry.segments, entry.hasRed);
        }
        this.citeBuffer = [];
        this.pendingCite = false;
      }
      return;
    }

    // 3b. We have a cite already; allow a few continuation lines to extend it.
    if (
      this.citeContinuationRemaining > 0 &&
      this.currentCard.cardTextSegments.length === 0 &&
      !parsed.hasHighlight &&
      isCiteContinuation(parsed.text)
    ) {
      this.currentCard.cite = joinCiteFragments(this.currentCard.cite, parsed.text);
      this.citeContinuationRemaining -= 1;
      return;
    }

    // 3c. Plain body text — append to the card.
    appendCardText(this.currentCard, parsed.segments, parsed.hasRed);
    this.citeContinuationRemaining = 0;
  }

  /**
   * Close out any in-flight card and return the assembled tree + warnings.
   */
  finish() {
    this._finalizePending();
    return { file: this.root, warnings: this.warnings };
  }

  _resetCiteState(continuationCount) {
    this.pendingCite = false;
    this.citeBuffer = [];
    this.citeContinuationRemaining = continuationCount;
  }

  _ensurePocket(title = this.options.defaultPocketTitle) {
    if (!this.currentPocket) {
      this.currentPocket = { type: 'pocket', title, children: [] };
      this.root.children.push(this.currentPocket);
    }
    return this.currentPocket;
  }

  _ensureHat(title = this.options.defaultHatTitle) {
    const pocket = this._ensurePocket();
    if (!this.currentHat) {
      this.currentHat = { type: 'hat', title, children: [] };
      pocket.children.push(this.currentHat);
    }
    return this.currentHat;
  }

  _getCardContainer() {
    if (this.currentBlock) return this.currentBlock;
    if (this.currentHat) return this.currentHat;
    if (this.currentPocket) return this.currentPocket;
    return this.root;
  }

  _finalizePending() {
    if (!this.currentCard) return;
    if (this.pendingCite) {
      markMissingCite(this.currentCard, this.warnings);
      for (const entry of this.citeBuffer) {
        appendCardText(this.currentCard, entry.segments, entry.hasRed);
      }
    }
  }
}

module.exports = {
  CardAssembler,
  appendCardText,
  markMissingCite,
};
