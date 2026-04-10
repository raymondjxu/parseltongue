const fs = require('fs');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const DEFAULT_OPTIONS = {
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
  defaultBlockTitle: 'Untitled Block'
};

const HEADING_STYLE_MAP = {
  heading1: 'pocket',
  heading2: 'hat',
  heading3: 'block',
  heading4: 'tag'
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: false,
  parseTagValue: false,
  isArray: (name) => ['w:p', 'w:r', 'w:t', 'w:br', 'w:tab'].includes(name)
});

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeStyleId(styleId) {
  if (!styleId) {
    return null;
  }
  return styleId.toLowerCase().replace(/\s+/g, '');
}

function parseFontSize(value) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasFlagValue(node) {
  if (node === undefined || node === null) {
    return false;
  }

  if (typeof node !== 'object') {
    return true;
  }

  const val = node['@_w:val'];
  if (val === undefined) {
    return true;
  }

  const normalized = String(val).toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}

function isBold(runPr, defaultPr) {
  return hasFlagValue(runPr?.['w:b']) || hasFlagValue(defaultPr?.['w:b']);
}

function getFontSize(runPr, defaultPr) {
  return (
    parseFontSize(runPr?.['w:sz']?.['@_w:val']) ||
    parseFontSize(defaultPr?.['w:sz']?.['@_w:val']) ||
    null
  );
}

function hasHighlight(runPr) {
  const highlightVal = runPr?.['w:highlight']?.['@_w:val'];
  if (highlightVal && !['none', 'white', 'auto'].includes(highlightVal.toLowerCase())) {
    return true;
  }
  const shdFill = runPr?.['w:shd']?.['@_w:fill'];
  if (shdFill && !['auto', 'ffffff', '000000'].includes(shdFill.toLowerCase())) {
    return true;
  }
  return false;
}

function hasRed(runPr, defaultPr) {
  const colorVal = runPr?.['w:color']?.['@_w:val'] || defaultPr?.['w:color']?.['@_w:val'];
  if (!colorVal) {
    return false;
  }
  const normalized = String(colorVal).toLowerCase();
  return normalized === 'ff0000' || normalized === 'red';
}

function escapeWhitespace(text) {
  return text.replace(/\u00a0/g, ' ');
}

function extractRunText(run) {
  let text = '';
  const textNodes = asArray(run?.['w:t']);
  for (const node of textNodes) {
    if (typeof node === 'string') {
      text += node;
    } else if (node && typeof node === 'object' && typeof node['#text'] === 'string') {
      text += node['#text'];
    }
  }

  const tabs = asArray(run?.['w:tab']);
  if (tabs.length) {
    text += '\t'.repeat(tabs.length);
  }

  const breaks = asArray(run?.['w:br']);
  if (breaks.length) {
    text += '\n'.repeat(breaks.length);
  }

  return escapeWhitespace(text);
}

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

function normalizePlainText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function containsUrlLikeToken(text) {
  if (!text) {
    return false;
  }
  return /https?:\/\//i.test(text) || /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[\w%./?=#&+-]*/i.test(text);
}

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

function parseParagraph(paragraph, options = DEFAULT_OPTIONS) {
  const pPr = paragraph?.['w:pPr'] || {};
  const styleId = pPr?.['w:pStyle']?.['@_w:val'] || null;
  const defaultPr = pPr?.['w:rPr'] || {};
  const runs = asArray(paragraph?.['w:r']);

  let totalLength = 0;
  let boldLength = 0;
  let atLeastTagFontLength = 0;
  let maxFontSize = null;
  const segments = [];
  let paragraphHasHighlight = false;
  let paragraphHasRed = false;

  for (const run of runs) {
    const runPr = run?.['w:rPr'] || {};
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
    hasRed: paragraphHasRed
  };
}

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
    if (fontSize >= options.pocketFontSizeMin) {
      return 'pocket';
    }
    if (fontSize >= options.hatFontSizeMin) {
      return 'hat';
    }
    if (fontSize >= options.blockFontSizeMin) {
      return 'block';
    }
    if (fontSize >= options.tagFontSizeMin && fontSize <= options.tagFontSizeMax && withinTagLength) {
      return 'tag';
    }
  }

  if (!fontSize) {
    return null;
  }

  const heuristicallyTagSized = paragraph.largeTextRatio >= options.heuristicTagLargeTextRatioMin;

  // Some docs omit bold metadata completely. In that case, rely on stable size tiers.
  if (context.hasStrongBoldSignal === false && heuristicallyTagSized && !containsUrlLikeToken(paragraph.text)) {
    if (fontSize >= options.pocketFontSizeMin) {
      return 'pocket';
    }
    if (fontSize >= options.hatFontSizeMin) {
      return 'hat';
    }
    if (fontSize >= options.blockFontSizeMin) {
      return 'block';
    }
    if (fontSize >= options.tagFontSizeMin && fontSize <= options.tagFontSizeMax && withinTagLength) {
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
  return /https?:\/\//i.test(normalized) || /\bpdf\b/i.test(normalized) || normalized.includes('//');
}

function isCiteContinuation(text) {
  if (!text) {
    return false;
  }
  if (/https?:\/\//i.test(text)) {
    return true;
  }
  if (/\b(accessed|date accessed|retrieved)\b/i.test(text)) {
    return true;
  }
  if (text.includes('//')) {
    return true;
  }
  return /\/[A-Za-z0-9]/.test(text) && text.length < 200;
}

function joinCiteFragments(previous, next) {
  if (!previous) {
    return normalizePlainText(next);
  }
  if (!next) {
    return normalizePlainText(previous);
  }
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
  if (!previous) {
    return normalizePlainText(next);
  }
  if (!next) {
    return normalizePlainText(previous);
  }
  return `${normalizePlainText(previous)} ${normalizePlainText(next)}`;
}

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

function flushCiteBufferToCardText(card, citeBuffer) {
  for (const entry of citeBuffer) {
    appendCardText(card, entry.segments, entry.hasRed);
  }
}

function finalizePendingCard(card, pendingCite, warnings, citeBuffer) {
  if (!card) {
    return;
  }
  if (pendingCite) {
    markMissingCite(card, warnings);
  }
  if (pendingCite && citeBuffer.length) {
    flushCiteBufferToCardText(card, citeBuffer);
  }
}

async function parseDocx(filePath, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file('word/document.xml');

  if (!documentFile) {
    throw new Error('Unable to find word/document.xml in docx file.');
  }

  const documentXml = await documentFile.async('string');
  const documentData = xmlParser.parse(documentXml);
  const paragraphs = asArray(documentData?.['w:document']?.['w:body']?.['w:p'])
    .map((paragraph) => parseParagraph(paragraph, settings))
    .filter((paragraph) => Boolean(paragraph.text));

  const hasStrongBoldSignal = paragraphs.some((paragraph) => paragraph.boldRatio >= settings.boldRatioThreshold);

  const root = { type: 'file', children: [] };
  const warnings = [];

  let currentPocket = null;
  let currentHat = null;
  let currentBlock = null;
  let currentCard = null;
  let pendingCite = false;
  let citeBuffer = [];
  let citeContinuationRemaining = 0;

  const ensurePocket = (title = settings.defaultPocketTitle) => {
    if (!currentPocket) {
      currentPocket = { type: 'pocket', title, children: [] };
      root.children.push(currentPocket);
    }
    return currentPocket;
  };

  const ensureHat = (title = settings.defaultHatTitle) => {
    const pocket = ensurePocket();
    if (!currentHat) {
      currentHat = { type: 'hat', title, children: [] };
      pocket.children.push(currentHat);
    }
    return currentHat;
  };

  const ensureBlock = (title = settings.defaultBlockTitle) => {
    const hat = ensureHat();
    if (!currentBlock) {
      currentBlock = { type: 'block', title, children: [] };
      hat.children.push(currentBlock);
    }
    return currentBlock;
  };

  const getCardContainer = () => {
    if (currentBlock) {
      return currentBlock;
    }
    if (currentHat) {
      return currentHat;
    }
    if (currentPocket) {
      return currentPocket;
    }
    return root;
  };

  for (const parsed of paragraphs) {
    if (currentCard && pendingCite && isCiteLine(parsed.text, settings)) {
      const citeLines = [...citeBuffer.map((entry) => entry.text), parsed.text];
      currentCard.cite = joinCiteLines(citeLines);
      pendingCite = false;
      citeBuffer = [];
      citeContinuationRemaining = settings.maxCiteParagraphs;
      continue;
    }

    const level = detectLevel(parsed, settings, { hasStrongBoldSignal });
    if (level === 'pocket') {
      finalizePendingCard(currentCard, pendingCite, warnings, citeBuffer);
      currentPocket = { type: 'pocket', title: parsed.text, children: [] };
      root.children.push(currentPocket);
      currentHat = null;
      currentBlock = null;
      currentCard = null;
      pendingCite = false;
      citeBuffer = [];
      citeContinuationRemaining = 0;
      continue;
    }

    if (level === 'hat') {
      finalizePendingCard(currentCard, pendingCite, warnings, citeBuffer);
      const pocket = ensurePocket();
      currentHat = { type: 'hat', title: parsed.text, children: [] };
      pocket.children.push(currentHat);
      currentBlock = null;
      currentCard = null;
      pendingCite = false;
      citeBuffer = [];
      citeContinuationRemaining = 0;
      continue;
    }

    if (level === 'block') {
      finalizePendingCard(currentCard, pendingCite, warnings, citeBuffer);
      const hat = ensureHat();
      currentBlock = { type: 'block', title: parsed.text, children: [] };
      hat.children.push(currentBlock);
      currentCard = null;
      pendingCite = false;
      citeBuffer = [];
      citeContinuationRemaining = 0;
      continue;
    }

    if (level === 'tag') {
      if (
        currentCard &&
        pendingCite &&
        !currentCard.cite &&
        currentCard.cardTextSegments.length === 0 &&
        citeBuffer.length === 0
      ) {
        currentCard.tag = joinTagFragments(currentCard.tag, parsed.text);
        continue;
      }

      finalizePendingCard(currentCard, pendingCite, warnings, citeBuffer);
      const card = {
        type: 'card',
        tag: parsed.text,
        cite: '',
        cardTextSegments: [],
        red: false,
        missingCite: false
      };
      getCardContainer().children.push(card);
      currentCard = card;
      pendingCite = true;
      citeBuffer = [];
      citeContinuationRemaining = 0;
      continue;
    }

    if (!currentCard) {
      continue;
    }

    if (pendingCite) {
      citeBuffer.push(parsed);
      if (citeBuffer.length >= settings.maxCiteParagraphs) {
        markMissingCite(currentCard, warnings);
        flushCiteBufferToCardText(currentCard, citeBuffer);
        citeBuffer = [];
        pendingCite = false;
      }
      continue;
    }

    if (
      citeContinuationRemaining > 0 &&
      currentCard.cardTextSegments.length === 0 &&
      !parsed.hasHighlight &&
      isCiteContinuation(parsed.text)
    ) {
      currentCard.cite = joinCiteFragments(currentCard.cite, parsed.text);
      citeContinuationRemaining -= 1;
      continue;
    }

    appendCardText(currentCard, parsed.segments, parsed.hasRed);
    citeContinuationRemaining = 0;
  }

  finalizePendingCard(currentCard, pendingCite, warnings, citeBuffer);

  return { file: root, warnings };
}

module.exports = {
  parseDocx,
  DEFAULT_OPTIONS
};
