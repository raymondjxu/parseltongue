const { parseDocx } = require('./parseDocx');
const { DEFAULT_OPTIONS, mergeOptions } = require('./options');
const { toXml } = require('./xml');
const { Card, CardDocument, parseCardXml, parseCardXmlFile } = require('./cardDocument');
const { parseParagraph, extractParagraphsFromDocument } = require('./paragraphParser');
const {
  detectLevel,
  isCiteLine,
  isCiteContinuation,
  containsUrlLikeToken,
  joinCiteFragments,
  joinCiteLines,
  joinTagFragments,
  normalizeStyleId,
} = require('./cardHeuristics');
const { CardAssembler } = require('./cardAssembler');

async function parseCaseDocx(filePath, options = {}) {
  const result = await parseDocx(filePath, options);
  return {
    ...result,
    xml: toXml(result.file),
  };
}

module.exports = {
  // Top-level entry points
  parseDocx,
  parseCaseDocx,
  toXml,
  DEFAULT_OPTIONS,
  mergeOptions,

  // Card model
  Card,
  CardDocument,
  parseCardXml,
  parseCardXmlFile,

  // Lower-level building blocks (for power users / custom pipelines)
  parseParagraph,
  extractParagraphsFromDocument,
  detectLevel,
  isCiteLine,
  isCiteContinuation,
  containsUrlLikeToken,
  joinCiteFragments,
  joinCiteLines,
  joinTagFragments,
  normalizeStyleId,
  CardAssembler,
};
