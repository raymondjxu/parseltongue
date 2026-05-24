const {
  detectLevel,
  isCiteLine,
  isCiteContinuation,
  joinCiteFragments,
  joinCiteLines,
  joinTagFragments,
  containsUrlLikeToken,
  normalizeStyleId,
} = require('../src/cardHeuristics');
const { DEFAULT_OPTIONS, mergeOptions } = require('../src/options');

const O = DEFAULT_OPTIONS;

function paragraph(overrides = {}) {
  return {
    styleId: null,
    text: '',
    segments: [],
    boldRatio: 0,
    largeTextRatio: 0,
    maxFontSize: null,
    hasHighlight: false,
    hasRed: false,
    ...overrides,
  };
}

describe('normalizeStyleId', () => {
  test.each([
    ['Heading 1', 'heading1'],
    ['HEADING2', 'heading2'],
    ['heading  3', 'heading3'],
    [null, null],
    ['', null],
  ])('normalizes %p -> %p', (input, expected) => {
    expect(normalizeStyleId(input)).toBe(expected);
  });
});

describe('containsUrlLikeToken', () => {
  test('detects bare URLs', () => {
    expect(containsUrlLikeToken('see https://example.com/foo')).toBe(true);
  });

  test('detects domain-with-path even without protocol', () => {
    expect(containsUrlLikeToken('www.example.com/article')).toBe(true);
  });

  test('rejects plain prose', () => {
    expect(containsUrlLikeToken('the quick brown fox')).toBe(false);
  });

  test('rejects empty input', () => {
    expect(containsUrlLikeToken('')).toBe(false);
    expect(containsUrlLikeToken(null)).toBe(false);
  });
});

describe('detectLevel — heading styles win', () => {
  test('Heading 1 → pocket regardless of font', () => {
    expect(detectLevel(paragraph({ styleId: 'Heading 1', text: 'A' }), O)).toBe('pocket');
  });

  test('Heading 4 longer than maxTagLength → null', () => {
    const text = 'x'.repeat(O.maxTagLength + 1);
    expect(detectLevel(paragraph({ styleId: 'Heading 4', text }), O)).toBeNull();
  });
});

describe('detectLevel — font + bold heuristic', () => {
  test('large + bold → pocket', () => {
    const p = paragraph({ text: 'P', maxFontSize: O.pocketFontSizeMin, boldRatio: 1 });
    expect(detectLevel(p, O, { hasStrongBoldSignal: true })).toBe('pocket');
  });

  test('block-sized + bold → block', () => {
    const p = paragraph({ text: 'B', maxFontSize: O.blockFontSizeMin, boldRatio: 1 });
    expect(detectLevel(p, O, { hasStrongBoldSignal: true })).toBe('block');
  });

  test('tag-sized + bold + within max length → tag', () => {
    const p = paragraph({ text: 'tag text', maxFontSize: O.tagFontSizeMin, boldRatio: 1 });
    expect(detectLevel(p, O, { hasStrongBoldSignal: true })).toBe('tag');
  });

  test('tag-sized + bold but URL-containing text — bold branch returns tag (no URL guard there)', () => {
    const p = paragraph({
      text: 'see https://example.com',
      maxFontSize: O.tagFontSizeMin,
      boldRatio: 1,
    });
    expect(detectLevel(p, O, { hasStrongBoldSignal: true })).toBe('tag');
  });

  test('fallback heuristic rejects URL-containing tag candidate (size-only path)', () => {
    const p = paragraph({
      text: 'see https://example.com',
      maxFontSize: O.tagFontSizeMin,
      boldRatio: 0,
      largeTextRatio: 1,
    });
    expect(detectLevel(p, O, { hasStrongBoldSignal: false })).toBeNull();
  });

  test('no font size → null', () => {
    const p = paragraph({ text: 'whatever', boldRatio: 1 });
    expect(detectLevel(p, O, { hasStrongBoldSignal: true })).toBeNull();
  });
});

describe('detectLevel — fallback when document has no bold metadata', () => {
  test('size-only path fires when bold signal is absent globally', () => {
    const p = paragraph({
      text: 'P',
      maxFontSize: O.pocketFontSizeMin,
      boldRatio: 0,
      largeTextRatio: 1,
    });
    expect(detectLevel(p, O, { hasStrongBoldSignal: false })).toBe('pocket');
  });

  test('size-only path does not fire when bold signal is present', () => {
    const p = paragraph({
      text: 'P',
      maxFontSize: O.pocketFontSizeMin,
      boldRatio: 0,
      largeTextRatio: 1,
    });
    expect(detectLevel(p, O, { hasStrongBoldSignal: true })).toBeNull();
  });
});

describe('isCiteLine', () => {
  test('short URL is a cite', () => {
    expect(isCiteLine('https://nyt.com/article')).toBe(true);
  });

  test('long URL above shortUrlCiteMaxLength still detected via protocol regex', () => {
    const longish = 'https://example.com/' + 'x'.repeat(O.shortUrlCiteMaxLength);
    expect(isCiteLine(longish)).toBe(true);
  });

  test('domain with no slash → not a cite', () => {
    expect(isCiteLine('example.com')).toBe(false);
  });

  test('text containing "pdf" → cite', () => {
    expect(isCiteLine('Smith 2023 pdf')).toBe(true);
  });

  test('empty input → false', () => {
    expect(isCiteLine('')).toBe(false);
  });
});

describe('isCiteContinuation', () => {
  test('URL → true', () => {
    expect(isCiteContinuation('https://example.com')).toBe(true);
  });

  test('"accessed Mar 1 2024" → true', () => {
    expect(isCiteContinuation('accessed Mar 1 2024')).toBe(true);
  });

  test('plain body text → false', () => {
    expect(isCiteContinuation('this is the rest of the card text')).toBe(false);
  });
});

describe('cite fragment joining', () => {
  test('joinCiteFragments collapses two URL halves with no space', () => {
    expect(joinCiteFragments('https://example.com/foo', 'bar/baz')).toBe(
      'https://example.com/foobar/baz'
    );
  });

  test('joinCiteFragments inserts a space between prose halves', () => {
    expect(joinCiteFragments('Smith 2023,', 'New York Times')).toBe('Smith 2023, New York Times');
  });

  test('joinCiteLines reduces an array left-to-right', () => {
    expect(joinCiteLines(['Smith', '2023', 'NYT'])).toBe('Smith 2023 NYT');
  });

  test('joinTagFragments always inserts a space', () => {
    expect(joinTagFragments('Trade war', 'cripples China')).toBe('Trade war cripples China');
  });
});

describe('mergeOptions', () => {
  test('user values override defaults', () => {
    const merged = mergeOptions({ maxTagLength: 50 });
    expect(merged.maxTagLength).toBe(50);
    expect(merged.pocketFontSizeMin).toBe(O.pocketFontSizeMin);
  });
});
