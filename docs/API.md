# Parseltongue API

This document describes the public JS API exposed by Parseltongue.

## Human Reference

### parseDocx(filePath, options?)

Parse a .docx debate file into the internal Card XML tree.

- Parameters:
  - filePath: string (path to .docx)
  - options?: object
    - pocketFontSizeMin?: number
    - hatFontSizeMin?: number
    - blockFontSizeMin?: number
    - tagFontSizeMin?: number
    - tagFontSizeMax?: number
    - boldRatioThreshold?: number
    - heuristicTagBoldRatioMin?: number
    - heuristicTagLargeTextRatioMin?: number
    - shortUrlCiteMaxLength?: number
    - maxCiteParagraphs?: number
    - defaultPocketTitle?: string
    - defaultHatTitle?: string
    - defaultBlockTitle?: string
- Returns: Promise<{ file: object, warnings: string[] }>
- Errors: throws if the docx cannot be opened or lacks word/document.xml

Example:

```js
const { parseDocx } = require('parseltongue');

const { file, warnings } = await parseDocx('case.docx');
console.log(warnings);
```

### parseCaseDocx(filePath, options?)

Parse a .docx and also return serialized Card XML.

- Parameters: same as parseDocx
- Returns: Promise<{ file: object, warnings: string[], xml: string }>

Example:

```js
const { parseCaseDocx } = require('parseltongue');

const { xml } = await parseCaseDocx('case.docx');
console.log(xml);
```

### toXml(fileNode)

Serialize an internal Card XML tree to a string.

- Parameters:
  - fileNode: object (tree from parseDocx)
- Returns: string

### CardDocument

CardDocument wraps parsed Card XML and provides access to cards.

#### CardDocument.fromXml(xmlString)

- Parameters:
  - xmlString: string (Card XML)
- Returns: CardDocument
- Errors: throws if the XML does not contain a <file> root element

#### CardDocument.fromFile(filePath)

- Parameters:
  - filePath: string (path to Card XML)
- Returns: Promise<CardDocument>

#### CardDocument.fromFileSync(filePath)

- Parameters:
  - filePath: string
- Returns: CardDocument

#### cardDocument.getCards()

- Returns: Card[]

Example:

```js
const { CardDocument } = require('parseltongue');

const doc = CardDocument.fromXml('<file><card><tag>T</tag><cite>C</cite><cardText>Text</cardText></card></file>');
const cards = doc.getCards();
```

### Card

Card represents a single <card> node.

- Properties:
  - tag: string
  - cite: string
  - segments: Array<{ text: string, highlighted: boolean }>
  - red: boolean (true when source text is already redlined)
  - missingCite: boolean
  - path: { pocket?: string | null, hat?: string | null, block?: string | null }

#### card.getFullText()

Returns the full concatenated card text (highlighted and non-highlighted).

#### card.getHighlightedText()

Returns the concatenated highlighted text only, whitespace-normalized.

#### card.getHighlightedSegments()

Returns the list of segments that are highlighted.

### parseCardXml(xmlString)

Parse Card XML into a CardDocument.

- Parameters:
  - xmlString: string
- Returns: CardDocument

### parseCardXmlFile(filePath)

Parse a Card XML file into a CardDocument.

- Parameters:
  - filePath: string
- Returns: Promise<CardDocument>

## LLM Reference (Concise)

```txt
parseDocx(filePath: string, options?: ParseDocxOptions)
  -> Promise<{ file: object, warnings: string[] }>

parseCaseDocx(filePath: string, options?: ParseDocxOptions)
  -> Promise<{ file: object, warnings: string[], xml: string }>

toXml(fileNode: object) -> string

class CardDocument
  static fromXml(xmlString: string) -> CardDocument
  static fromFile(filePath: string) -> Promise<CardDocument>
  static fromFileSync(filePath: string) -> CardDocument
  getCards() -> Card[]

class Card
  tag: string
  cite: string
  segments: Array<{ text: string, highlighted: boolean }>
  red: boolean
  missingCite: boolean
  path: { pocket?: string|null, hat?: string|null, block?: string|null }
  getFullText() -> string
  getHighlightedText() -> string
  getHighlightedSegments() -> Array<{ text: string, highlighted: boolean }>

parseCardXml(xmlString: string) -> CardDocument
parseCardXmlFile(filePath: string) -> Promise<CardDocument>

ParseDocxOptions = {
  pocketFontSizeMin?: number,
  hatFontSizeMin?: number,
  blockFontSizeMin?: number,
  tagFontSizeMin?: number,
  tagFontSizeMax?: number,
  boldRatioThreshold?: number,
  heuristicTagBoldRatioMin?: number,
  heuristicTagLargeTextRatioMin?: number,
  shortUrlCiteMaxLength?: number,
  maxCiteParagraphs?: number,
  defaultPocketTitle?: string,
  defaultHatTitle?: string,
  defaultBlockTitle?: string
}
```
