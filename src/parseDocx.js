const fs = require('fs');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const { DEFAULT_OPTIONS, mergeOptions } = require('./options');
const { ARRAY_ELEMENTS } = require('./wordXmlConstants');
const { extractParagraphsFromDocument } = require('./paragraphParser');
const { CardAssembler } = require('./cardAssembler');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: false,
  parseTagValue: false,
  isArray: (name) => ARRAY_ELEMENTS.includes(name),
});

/**
 * Parse a `.docx` file into a card-tree.
 *
 * @param {string} filePath
 * @param {Partial<import('./options').ParseDocxOptions>} [options]
 * @returns {Promise<{ file: object, warnings: string[] }>}
 */
async function parseDocx(filePath, options = {}) {
  const settings = mergeOptions(options);
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file('word/document.xml');

  if (!documentFile) {
    throw new Error('Unable to find word/document.xml in docx file.');
  }

  const documentXml = await documentFile.async('string');
  const documentData = xmlParser.parse(documentXml);
  const paragraphs = extractParagraphsFromDocument(documentData, settings);

  const hasStrongBoldSignal = paragraphs.some(
    (paragraph) => paragraph.boldRatio >= settings.boldRatioThreshold
  );

  const assembler = new CardAssembler(settings, { hasStrongBoldSignal });
  for (const paragraph of paragraphs) {
    assembler.consume(paragraph);
  }
  return assembler.finish();
}

module.exports = {
  parseDocx,
  DEFAULT_OPTIONS,
};
