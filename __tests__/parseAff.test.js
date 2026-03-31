const path = require('path');
const { parseCaseDocx, CardDocument } = require('../src');

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
  const mergedTagCard = cards.find((card) => card.tag.includes('Chinese economic dominance in Africa'));
  expect(mergedTagCard).toBeDefined();
  expect(mergedTagCard.tag).toContain("Bartha '25");
  expect(mergedTagCard.cite).toContain('Levente Bartha');
  expect(mergedTagCard.getFullText().length).toBeGreaterThan(0);
  expect(cards.some((card) => card.tag === "Bartha '25")).toBe(false);
  expect(warnings).not.toContain(
    expect.stringContaining('Missing cite for tag: Chinese economic dominance in Africa crowds out Russian influence')
  );
});
