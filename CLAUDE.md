# parseltongue — Claude reference

DOCX → debate-card-tree parser. The first stage of the autodict pipeline; produces the card XML that `slytherin` and `jackhammer-ui` consume.

CommonJS, no build step. `index.d.ts` ships hand-written types for the public API.

## File map

| File | Lines | Purpose |
|---|---|---|
| `src/parseDocx.js` | ~55 | Orchestrator: unzip docx → fast-xml-parser → `paragraphParser` → `cardAssembler`. |
| `src/options.js` | ~65 | `DEFAULT_OPTIONS` + `mergeOptions(user)`. Every magic number has JSDoc explaining what it measures. |
| `src/wordXmlConstants.js` | ~75 | `w:p`, `w:r`, etc. element/attr names. Touch here if Word's XML schema shifts. Also exports the small `asArray` helper. |
| `src/textUtils.js` | ~95 | Pure text/segment helpers: `normalizePlainText`, `pushSegment`, `normalizeSegments`, NBSP normalisation. |
| `src/paragraphParser.js` | ~200 | `parseParagraph(xml, options) → ParsedParagraph` and `extractParagraphsFromDocument`. Owns paragraph-level XML extraction + run-formatting analysis (bold ratio, max font, highlights). |
| `src/cardHeuristics.js` | ~165 | Pure functions: `detectLevel`, `isCiteLine`, `isCiteContinuation`, `joinCiteFragments`, `joinCiteLines`, `joinTagFragments`. No state. |
| `src/cardAssembler.js` | ~235 | `CardAssembler` class — stateful walker that consumes `ParsedParagraph[]` in order and builds the pocket→hat→block→card tree. |
| `src/cardDocument.js` | ~270 | `Card` + `CardDocument`: XML serialisation/deserialisation, card-level accessors. Independent of the heuristics. |
| `src/xml.js` | ~80 | `toXml(fileNode)` for output. Used by `parseCaseDocx`. |
| `src/index.js` | ~50 | Public re-exports. |
| `bin/autodict.js` | ~55 | CLI: `autodict parse <file.docx> [-o output.xml]`. |

## Where to add features

- **New card-tree heuristic (e.g. detecting a new heading level).** Add a pure function in `src/cardHeuristics.js`, then call it from `src/cardAssembler.js#consume`. Write a table-driven test in `__tests__/cardHeuristics.test.js`.
- **New paragraph-formatting signal.** Extend `ParsedParagraph` in `paragraphParser.js`. Update the JSDoc typedef and `index.d.ts`. Add to `__tests__/paragraphParser.test.js`.
- **New magic threshold.** Add to `src/options.js` with a JSDoc `@property` explaining what it measures and why the default was chosen.
- **New Word XML element to read.** Add the string to `src/wordXmlConstants.js`, never inline.

## Tests

- `__tests__/cardHeuristics.test.js`, `paragraphParser.test.js`, `cardAssembler.test.js` — pure-function unit tests using synthetic inputs. Fast. Run these while iterating.
- `__tests__/parseAff.test.js` — integration test against `fixtures/AFF -- Balochistan.docx` with a Jest snapshot. The safety net proving the orchestrator stays equivalent to old behaviour.
- `__tests__/cardDocument.test.js` — Card/CardDocument round-trip + accessors.

```bash
npm test                              # all
npm test -- cardHeuristics            # one suite
npm test -- --updateSnapshot          # regenerate parseAff snapshot if you intentionally changed parsing
```

## Updating the fixture snapshot

If parser changes legitimately alter the cards extracted from `fixtures/AFF -- Balochistan.docx`, regenerate the snapshot with `npm test -- --updateSnapshot` and commit the new snapshot file. Eyeball the diff — every changed line is a behavioural change you're locking in.

## Gotchas

- **Word emits NBSP (U+00A0) heavily.** `textUtils.escapeWhitespace` converts to regular spaces. Constructed via `String.fromCharCode(0xa0)` so the source stays pure ASCII (literal NBSP is invisible in most editors).
- **Heading-style detection wins over font/bold heuristics.** A paragraph with `w:pStyle="Heading 1"` becomes a pocket regardless of size. Only when style is missing do we fall back to size + bold ratio.
- **Bold-signal fallback.** If the doc has *no* bold metadata anywhere (some converters strip it), `cardAssembler` falls back to size-only classification (`hasStrongBoldSignal === false` path in `detectLevel`).
- **`CardAssembler.consume` requires document order.** Out-of-order paragraphs corrupt the tree.

## API stability

This module is consumed only by jackhammer-ui via `file:../parseltongue`. APIs may change with the parent repo's pointer bump. Update `index.d.ts` when adding/changing exports.
