const path = require('path');
const { parseCaseDocx, parseDocx, CardDocument } = require('../src');

function collectNodesOfType(node, type, output = []) {
  if (!node || typeof node !== 'object') {
    return output;
  }
  if (node.type === type) {
    output.push(node);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectNodesOfType(child, type, output);
    }
  }
  return output;
}

test('parses AFF -- Balochistan into card xml', async () => {
  const fixturePath = path.join(__dirname, '..', '..', 'fixtures', 'AFF -- Balochistan.docx');
  const { xml } = await parseCaseDocx(fixturePath);
  expect(xml).toMatchSnapshot();
});

test('merges consecutive tag headings before cite for cardExamples', async () => {
  const fixturePath = path.join(__dirname, '..', '..', 'fixtures', 'cardExamples.docx');
  const { xml, warnings } = await parseCaseDocx(fixturePath);
  const cards = CardDocument.fromXml(xml).getCards();

  expect(cards).toHaveLength(5);
  const mergedTagCard = cards.find((card) =>
    card.tag.includes('Chinese economic dominance in Africa')
  );
  expect(mergedTagCard).toBeDefined();
  expect(mergedTagCard.tag).toContain("Bartha '25");
  expect(mergedTagCard.cite).toContain('Levente Bartha');
  expect(mergedTagCard.getFullText().length).toBeGreaterThan(0);
  expect(cards.some((card) => card.tag === "Bartha '25")).toBe(false);
  expect(warnings).not.toContain(
    expect.stringContaining(
      'Missing cite for tag: Chinese economic dominance in Africa crowds out Russian influence'
    )
  );
});

test('uses bold/size heuristics to split tags in minimally styled docs', async () => {
  const fixturePath = path.join(
    __dirname,
    '..',
    '..',
    'fixtures',
    'Harker-LeLu-Pro-10---King-Round-Robin-Semis.docx'
  );
  const { xml, warnings } = await parseCaseDocx(fixturePath);
  const cards = CardDocument.fromXml(xml).getCards();

  expect(cards.length).toBeGreaterThan(1);
  expect(
    cards.some((card) => card.tag.includes('Lack of dialogue causes nuclear miscalculation.'))
  ).toBe(true);
  expect(cards.some((card) => card.cite.includes('http'))).toBe(true);
  expect(cards[0].tag).not.toMatch(/https?:\/\//i);
  expect(warnings).toHaveLength(0);
});

test('detects both AT headings as blocks in Harker fixture', async () => {
  const fixturePath = path.join(
    __dirname,
    '..',
    '..',
    'fixtures',
    'Harker-LeLu-Pro-10---King-Round-Robin-Semis.docx'
  );

  const { file } = await parseDocx(fixturePath);
  const blockTitles = collectNodesOfType(file, 'block').map((block) => block.title);

  expect(blockTitles).toEqual(expect.arrayContaining(['AT: PMCs', 'AT: Russia Deterrence']));
});

test('does not classify very long Durham body paragraphs as tags', async () => {
  const fixturePath = path.join(__dirname, '..', '..', 'fixtures', '_Durham RR neg case.docx');
  const { xml } = await parseCaseDocx(fixturePath);
  const cards = CardDocument.fromXml(xml).getCards();

  expect(cards.some((card) => card.tag.length > 400)).toBe(false);
  expect(
    cards.some((card) => card.tag.includes('Djibouti enjoys a geostrategic significance'))
  ).toBe(false);
  expect(
    cards.some((card) => card.getFullText().includes('Djibouti enjoys a geostrategic significance'))
  ).toBe(true);
});
