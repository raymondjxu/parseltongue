#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { parseCaseDocx } = require('../src');

function printUsage() {
  console.log('Usage: autodict parse <file.docx> [-o output.xml]');
}

async function main() {
  const args = minimist(process.argv.slice(2), {
    alias: { o: 'output' },
  });
  const [command, inputFile] = args._;

  if (!command || command === 'help' || command === '--help') {
    printUsage();
    return;
  }

  if (command !== 'parse') {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  if (!inputFile) {
    console.error('Input file is required.');
    printUsage();
    process.exit(1);
  }

  const resolvedInput = path.resolve(process.cwd(), inputFile);
  const { xml, warnings } = await parseCaseDocx(resolvedInput);

  for (const warning of warnings) {
    console.warn(warning);
  }

  if (args.output) {
    const resolvedOutput = path.resolve(process.cwd(), args.output);
    fs.writeFileSync(resolvedOutput, xml, 'utf8');
    return;
  }

  process.stdout.write(xml);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
