const { parseParagraph, extractParagraphsFromDocument } = require('../src/paragraphParser');
const { DEFAULT_OPTIONS } = require('../src/options');

// fast-xml-parser output shape — built by hand so tests don't depend on .docx fixtures.
function run({ text, bold = false, size = null, highlight = false, color = null } = {}) {
  const rPr = {};
  if (bold) rPr['w:b'] = {};
  if (size) rPr['w:sz'] = { '@_w:val': String(size) };
  if (highlight) rPr['w:highlight'] = { '@_w:val': 'yellow' };
  if (color) rPr['w:color'] = { '@_w:val': color };

  return {
    'w:rPr': rPr,
    'w:t': [{ '#text': text }],
  };
}

function para({ styleId = null, runs = [] } = {}) {
  const pPr = {};
  if (styleId) pPr['w:pStyle'] = { '@_w:val': styleId };
  return {
    'w:pPr': pPr,
    'w:r': runs,
  };
}

describe('parseParagraph', () => {
  test('empty paragraph → empty text, zero ratios', () => {
    const result = parseParagraph(para({ runs: [] }), DEFAULT_OPTIONS);
    expect(result.text).toBe('');
    expect(result.boldRatio).toBe(0);
    expect(result.maxFontSize).toBeNull();
  });

  test('plain text run → text and zero bold ratio', () => {
    const result = parseParagraph(para({ runs: [run({ text: 'hello world' })] }), DEFAULT_OPTIONS);
    expect(result.text).toBe('hello world');
    expect(result.boldRatio).toBe(0);
    expect(result.segments).toEqual([{ text: 'hello world', highlighted: false }]);
  });

  test('fully bold paragraph → boldRatio 1', () => {
    const result = parseParagraph(
      para({ runs: [run({ text: 'tag text', bold: true })] }),
      DEFAULT_OPTIONS
    );
    expect(result.boldRatio).toBe(1);
  });

  test('half-bold paragraph → boldRatio ~0.5', () => {
    const result = parseParagraph(
      para({
        runs: [run({ text: 'aaaa', bold: true }), run({ text: 'bbbb', bold: false })],
      }),
      DEFAULT_OPTIONS
    );
    expect(result.boldRatio).toBeCloseTo(0.5, 5);
  });

  test('captures maxFontSize across runs', () => {
    const result = parseParagraph(
      para({ runs: [run({ text: 'a', size: 24 }), run({ text: 'b', size: 32 })] }),
      DEFAULT_OPTIONS
    );
    expect(result.maxFontSize).toBe(32);
  });

  test('highlight propagates to segment and paragraph flag', () => {
    const result = parseParagraph(
      para({
        runs: [
          run({ text: 'before ' }),
          run({ text: 'mid', highlight: true }),
          run({ text: ' after' }),
        ],
      }),
      DEFAULT_OPTIONS
    );
    expect(result.hasHighlight).toBe(true);
    expect(result.segments).toEqual([
      { text: 'before ', highlighted: false },
      { text: 'mid', highlighted: true },
      { text: ' after', highlighted: false },
    ]);
  });

  test('red color flag detected', () => {
    const result = parseParagraph(
      para({ runs: [run({ text: 'warning', color: 'FF0000' })] }),
      DEFAULT_OPTIONS
    );
    expect(result.hasRed).toBe(true);
  });

  test('styleId surfaced from paragraph properties', () => {
    const result = parseParagraph(
      para({ styleId: 'Heading 1', runs: [run({ text: 'Pocket A' })] }),
      DEFAULT_OPTIONS
    );
    expect(result.styleId).toBe('Heading 1');
  });

  test('largeTextRatio reflects fraction at tag font or above', () => {
    const result = parseParagraph(
      para({
        runs: [
          run({ text: 'aaaa', size: DEFAULT_OPTIONS.tagFontSizeMin }),
          run({ text: 'bbbb', size: 10 }),
        ],
      }),
      DEFAULT_OPTIONS
    );
    expect(result.largeTextRatio).toBeCloseTo(0.5, 5);
  });
});

describe('extractParagraphsFromDocument', () => {
  test('skips empty paragraphs and preserves order', () => {
    const doc = {
      'w:document': {
        'w:body': {
          'w:p': [
            para({ runs: [run({ text: 'first' })] }),
            para({ runs: [] }),
            para({ runs: [run({ text: 'second' })] }),
          ],
        },
      },
    };
    const result = extractParagraphsFromDocument(doc, DEFAULT_OPTIONS);
    expect(result.map((p) => p.text)).toEqual(['first', 'second']);
  });

  test('missing body returns empty list, no throw', () => {
    expect(extractParagraphsFromDocument({}, DEFAULT_OPTIONS)).toEqual([]);
  });
});
