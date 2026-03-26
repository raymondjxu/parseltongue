const path = require('path');
const { parseCaseDocx } = require('../src');

test('parses AFF -- Balochistan into card xml', async () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'AFF -- Balochistan.docx');
  const { xml } = await parseCaseDocx(fixturePath);
  expect(xml).toMatchSnapshot();
});
