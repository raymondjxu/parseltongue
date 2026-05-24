const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

const cardXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  alwaysCreateTextNode: true,
  trimValues: false,
});

function toArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function extractText(nodes) {
  const items = toArray(nodes);
  let text = '';
  for (const item of items) {
    if (typeof item === 'string') {
      text += item;
      continue;
    }
    if (item && typeof item['#text'] === 'string') {
      text += item['#text'];
    }
  }
  return text;
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

function parseCardText(nodes) {
  const segments = [];
  const items = toArray(nodes);
  for (const item of items) {
    if (item && typeof item['#text'] === 'string') {
      pushSegment(segments, item['#text'], false);
      continue;
    }
    if (item && item.highlight) {
      const highlightedText = extractText(item.highlight);
      pushSegment(segments, highlightedText, true);
    }
  }
  return segments;
}

function normalizeHighlightedText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

const DEFAULT_TRIM_WORD_WINDOW = 20;

function collectWordSpans(segments) {
  const words = [];
  let offset = 0;

  for (const segment of segments || []) {
    const text = String(segment?.text || '');
    const highlighted = Boolean(segment?.highlighted);
    const wordPattern = /\S+/g;
    let match = wordPattern.exec(text);

    while (match) {
      words.push({
        start: offset + match.index,
        end: offset + match.index + match[0].length,
        highlighted,
      });
      match = wordPattern.exec(text);
    }

    offset += text.length;
  }

  return words;
}

class Card {
  constructor({ tag, cite, segments, red, missingCite, path }) {
    this.tag = tag || '';
    this.cite = cite || '';
    this.segments = segments || [];
    this.red = Boolean(red);
    this.missingCite = Boolean(missingCite);
    this.path = path || {};
  }

  getFullText() {
    return this.segments.map((segment) => segment.text).join('');
  }

  getHighlightedText() {
    const highlighted = this.segments.filter((segment) => segment.highlighted);
    return normalizeHighlightedText(highlighted.map((segment) => segment.text).join(' '));
  }

  getTrimmedFullText(wordWindow = DEFAULT_TRIM_WORD_WINDOW) {
    const fullText = this.getFullText();
    if (!fullText) {
      return '';
    }

    const words = collectWordSpans(this.segments);
    if (!words.length) {
      return fullText;
    }

    let firstHighlightedIndex = -1;
    let lastHighlightedIndex = -1;

    for (let index = 0; index < words.length; index += 1) {
      if (!words[index].highlighted) {
        continue;
      }
      if (firstHighlightedIndex === -1) {
        firstHighlightedIndex = index;
      }
      lastHighlightedIndex = index;
    }

    if (firstHighlightedIndex === -1) {
      return fullText;
    }

    const safeWordWindow = Math.max(0, Number.parseInt(wordWindow, 10) || 0);
    const startWordIndex = Math.max(0, firstHighlightedIndex - safeWordWindow);
    const endWordIndex = Math.min(words.length - 1, lastHighlightedIndex + safeWordWindow);

    const startChar = startWordIndex === 0 ? 0 : words[startWordIndex].start;
    const endChar = endWordIndex === words.length - 1 ? fullText.length : words[endWordIndex].end;

    let trimmed = fullText.slice(startChar, endChar).trim();
    if (!trimmed) {
      return '';
    }
    if (startWordIndex > 0) {
      trimmed = `(trimmed head) ${trimmed}`;
    }
    if (endWordIndex < words.length - 1) {
      trimmed = `${trimmed} (trimmed tail)`;
    }

    return trimmed;
  }

  getHighlightedSegments() {
    return this.segments.filter((segment) => segment.highlighted);
  }
}

class CardDocument {
  constructor(cards) {
    this.cards = cards || [];
  }

  getCards() {
    return [...this.cards];
  }

  static fromXml(xmlString) {
    const parsed = cardXmlParser.parse(xmlString);
    const root = parsed.find((node) => node.file);
    if (!root || !root.file) {
      throw new Error('Invalid Card XML: missing <file> root element.');
    }
    const cards = [];
    walkNodes(root.file, { pocket: null, hat: null, block: null }, cards);
    return new CardDocument(cards);
  }

  static async fromFile(filePath) {
    const xmlString = await fs.promises.readFile(filePath, 'utf8');
    return CardDocument.fromXml(xmlString);
  }

  static fromFileSync(filePath) {
    const xmlString = fs.readFileSync(filePath, 'utf8');
    return CardDocument.fromXml(xmlString);
  }
}

function getAttribute(node, name) {
  const attrs = node?.[':@'] || {};
  return attrs[`@_${name}`];
}

function parseCardNode(node, path, cards) {
  const cardNodes = toArray(node.card);
  const tagNode = cardNodes.find((child) => child.tag);
  const citeNode = cardNodes.find((child) => child.cite);
  const cardTextNode = cardNodes.find((child) => child.cardText);

  const tag = tagNode ? extractText(tagNode.tag) : '';
  const cite = citeNode ? extractText(citeNode.cite) : '';
  const segments = cardTextNode ? parseCardText(cardTextNode.cardText) : [];
  const red = getAttribute(node, 'red') === 'true';
  const missingCite = getAttribute(node, 'missingCite') === 'true';

  cards.push(
    new Card({
      tag,
      cite,
      segments,
      red,
      missingCite,
      path,
    })
  );
}

function extractTitle(nodes) {
  const titleNode = toArray(nodes).find((child) => child.title);
  if (!titleNode) {
    return null;
  }
  return extractText(titleNode.title);
}

function walkNodes(nodes, path, cards) {
  for (const node of toArray(nodes)) {
    if (node.card) {
      parseCardNode(node, path, cards);
      continue;
    }
    if (node.pocket) {
      const title = extractTitle(node.pocket);
      walkNodes(node.pocket, { ...path, pocket: title }, cards);
      continue;
    }
    if (node.hat) {
      const title = extractTitle(node.hat);
      walkNodes(node.hat, { ...path, hat: title }, cards);
      continue;
    }
    if (node.block) {
      const title = extractTitle(node.block);
      walkNodes(node.block, { ...path, block: title }, cards);
      continue;
    }
  }
}

function parseCardXml(xmlString) {
  return CardDocument.fromXml(xmlString);
}

async function parseCardXmlFile(filePath) {
  return CardDocument.fromFile(filePath);
}

module.exports = {
  Card,
  CardDocument,
  parseCardXml,
  parseCardXmlFile,
};
