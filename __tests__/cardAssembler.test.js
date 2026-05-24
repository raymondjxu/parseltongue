const { CardAssembler } = require('../src/cardAssembler');
const { DEFAULT_OPTIONS } = require('../src/options');

const O = DEFAULT_OPTIONS;

function p(overrides = {}) {
  return {
    styleId: null,
    text: '',
    segments: [{ text: overrides.text ?? '', highlighted: false }],
    boldRatio: 0,
    largeTextRatio: 0,
    maxFontSize: null,
    hasHighlight: false,
    hasRed: false,
    ...overrides,
  };
}

// Convenient builders for each level
const pocket = (text) => p({ styleId: 'Heading 1', text });
const hat = (text) => p({ styleId: 'Heading 2', text });
const block = (text) => p({ styleId: 'Heading 3', text });
const tag = (text) => p({ styleId: 'Heading 4', text });
const cite = (text) => p({ text, segments: [{ text, highlighted: false }] });
const body = (text, opts = {}) => p({ text, segments: [{ text, highlighted: false }], ...opts });

function run(paragraphs) {
  const assembler = new CardAssembler(O, { hasStrongBoldSignal: true });
  for (const para of paragraphs) {
    assembler.consume(para);
  }
  return assembler.finish();
}

describe('CardAssembler — happy path', () => {
  test('pocket → hat → block → tag → cite → body produces one card', () => {
    const { file, warnings } = run([
      pocket('Disad'),
      hat('Trump Good'),
      block('Generic'),
      tag('Trump wins now'),
      cite('https://nyt.com/article'),
      body('Card body text here.'),
    ]);

    expect(warnings).toEqual([]);
    expect(file.children).toHaveLength(1);
    const pocketNode = file.children[0];
    expect(pocketNode.title).toBe('Disad');
    const hatNode = pocketNode.children[0];
    expect(hatNode.title).toBe('Trump Good');
    const blockNode = hatNode.children[0];
    expect(blockNode.title).toBe('Generic');
    const card = blockNode.children[0];
    expect(card.tag).toBe('Trump wins now');
    expect(card.cite).toBe('https://nyt.com/article');
    expect(card.cardTextSegments.map((s) => s.text).join('')).toContain('Card body text here.');
    expect(card.missingCite).toBe(false);
  });
});

describe('CardAssembler — missing cite', () => {
  test('tag followed by maxCiteParagraphs of body → card flagged missing cite', () => {
    const lines = [];
    for (let i = 0; i < O.maxCiteParagraphs; i += 1) {
      lines.push(body(`body line ${i + 1}`));
    }
    // No surrounding pocket/hat/block → card attaches directly under file root.
    const { file, warnings } = run([tag('Sketchy tag'), ...lines]);

    const card = file.children[0];
    expect(card.type).toBe('card');
    expect(card.missingCite).toBe(true);
    expect(card.cite).toBe('');
    expect(warnings).toContainEqual(expect.stringContaining('Missing cite'));
    // Buffered body text should still end up on the card
    expect(card.cardTextSegments.length).toBeGreaterThan(0);
  });

  test('finish() flushes a pending cite buffer that never fills', () => {
    const { file, warnings } = run([tag('Bare tag'), body('only one body line')]);
    const card = file.children[0];
    expect(card.type).toBe('card');
    expect(card.missingCite).toBe(true);
    expect(warnings).toHaveLength(1);
  });
});

describe('CardAssembler — tag continuation', () => {
  test('second tag immediately after the first (before cite or body) merges into one card', () => {
    const { file } = run([tag('First half'), tag('second half'), cite('https://x.com/y')]);
    expect(file.children).toHaveLength(1);
    const card = file.children[0];
    expect(card.type).toBe('card');
    expect(card.tag).toBe('First half second half');
  });

  test('second tag after a cite starts a new card', () => {
    const { file } = run([
      tag('First'),
      cite('https://x.com/a'),
      body('first body'),
      tag('Second'),
      cite('https://x.com/b'),
      body('second body'),
    ]);
    expect(file.children).toHaveLength(2);
    expect(file.children[0].tag).toBe('First');
    expect(file.children[1].tag).toBe('Second');
  });
});

describe('CardAssembler — container reset semantics', () => {
  test('a new pocket clears hat/block/card state', () => {
    const { file } = run([
      pocket('P1'),
      hat('H1'),
      tag('T1'),
      cite('https://x.com/1'),
      body('body 1'),
      pocket('P2'),
      tag('T2'),
      cite('https://x.com/2'),
      body('body 2'),
    ]);
    expect(file.children).toHaveLength(2);
    // P2 has no hat — tag goes directly under the pocket (no auto-hat).
    const p2 = file.children[1];
    expect(p2.children[0].type).toBe('card');
    expect(p2.children[0].tag).toBe('T2');
  });

  test('tag with no surrounding pocket/hat/block attaches directly to file root', () => {
    const { file } = run([tag('Lonely tag'), cite('https://x.com/lone')]);
    expect(file.children[0].type).toBe('card');
    expect(file.children[0].tag).toBe('Lonely tag');
  });

  test('hat with no preceding pocket auto-creates a default pocket', () => {
    const { file } = run([hat('H'), tag('T'), cite('https://x.com/h')]);
    expect(file.children[0].type).toBe('pocket');
    expect(file.children[0].title).toBe(O.defaultPocketTitle);
    expect(file.children[0].children[0].type).toBe('hat');
  });
});

describe('CardAssembler — cite continuation', () => {
  test('paragraphs immediately after a cite that look like cite continuations are folded in', () => {
    const { file } = run([
      tag('T'),
      cite('https://example.com/path'),
      body('accessed Mar 1 2024'),
      body('actual body of the card.'),
    ]);
    const card = file.children[0];
    expect(card.cite).toContain('accessed Mar 1 2024');
    expect(card.cardTextSegments.map((s) => s.text).join('')).toContain('actual body');
  });
});

describe('CardAssembler — red text propagation', () => {
  test('a red body paragraph marks the card as red', () => {
    const { file } = run([
      tag('T'),
      cite('https://example.com/'),
      body('warning text', { hasRed: true }),
    ]);
    const card = file.children[0];
    expect(card.red).toBe(true);
  });
});
