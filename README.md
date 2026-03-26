# Parseltongue

Parseltongue parses debate cards into machine readable XML files.

## API Reference

See [docs/API.md](docs/API.md) for human and LLM readable API docs.

## Card XML Helpers

Use the helpers to work with Card XML outputs.

```js
const { CardDocument } = require('parseltongue');

async function loadCards() {
	const doc = await CardDocument.fromFile('cards.xml');
	const cards = doc.getCards();

	const first = cards[0];
	console.log(first.getFullText());
	console.log(first.getHighlightedText());
}
```