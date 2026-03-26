const { parseDocx, DEFAULT_OPTIONS } = require('./parseDocx');
const { toXml } = require('./xml');

async function parseCaseDocx(filePath, options = {}) {
  const result = await parseDocx(filePath, options);
  return {
    ...result,
    xml: toXml(result.file)
  };
}

module.exports = {
  parseDocx,
  parseCaseDocx,
  toXml,
  DEFAULT_OPTIONS
};
