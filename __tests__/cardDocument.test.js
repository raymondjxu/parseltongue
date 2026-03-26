const path = require('path');
const {
  CardDocument,
  parseCardXml,
  parseCardXmlFile
} = require('../src');

describe('CardDocument', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'card-sample.xml');

  test('parses cards from XML string', () => {
    const xml = `<?xml version="1.0"?>\n<file>\n  <card red="true" missingCite="true">\n    <tag>Tag A</tag>\n    <cite></cite>\n    <cardText>Intro <highlight>Key</highlight> tail</cardText>\n  </card>\n</file>`;
    const doc = CardDocument.fromXml(xml);
    const cards = doc.getCards();

    expect(cards).toHaveLength(1);
    expect(cards[0].tag).toBe('Tag A');
    expect(cards[0].cite).toBe('');
    expect(cards[0].red).toBe(true);
    expect(cards[0].missingCite).toBe(true);
    expect(cards[0].getFullText()).toBe('Intro Key tail');
    expect(cards[0].getHighlightedText()).toBe('Key');
    expect(cards[0].getHighlightedSegments()).toEqual([
      { text: 'Key', highlighted: true }
    ]);
  });

  test('parses cards from file helpers', async () => {
    const doc = await parseCardXmlFile(fixturePath);
    const cards = doc.getCards();

    expect(cards).toHaveLength(2);
    expect(cards[0].path).toEqual({
      pocket: 'Top Pocket',
      hat: 'Hat Title',
      block: 'Block Title'
    });
    expect(cards[0].red).toBe(true);
    expect(cards[0].missingCite).toBe(true);
    expect(cards[0].getHighlightedText()).toBe('Key');

    expect(cards[1].tag).toBe('Tag B');
    expect(cards[1].cite).toBe('Source');
    expect(cards[1].red).toBe(false);
    expect(cards[1].missingCite).toBe(false);
    expect(cards[1].getHighlightedText()).toBe('');
  });

  test('parses cards from CardDocument.fromFileSync', () => {
    const doc = CardDocument.fromFileSync(fixturePath);
    const cards = doc.getCards();

    expect(cards).toHaveLength(2);
    expect(cards[0].tag).toBe('Tag A');
    expect(cards[0].getFullText()).toBe('Intro Key tail');
  });

  test('parseCardXml returns CardDocument', () => {
    const xml = '<file><card><tag>T</tag><cite>C</cite><cardText>Text</cardText></card></file>';
    const doc = parseCardXml(xml);
    expect(doc).toBeInstanceOf(CardDocument);
    expect(doc.getCards()[0].tag).toBe('T');
  });
});
