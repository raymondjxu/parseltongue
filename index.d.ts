export interface CardSegment {
  text: string;
  highlighted: boolean;
}

export interface CardPath {
  pocket?: string | null;
  hat?: string | null;
  block?: string | null;
}

export class Card {
  constructor(options: {
    tag: string;
    cite: string;
    segments: CardSegment[];
    red?: boolean;
    missingCite?: boolean;
    path?: CardPath;
  });

  tag: string;
  cite: string;
  segments: CardSegment[];
  red: boolean;
  missingCite: boolean;
  path: CardPath;

  getFullText(): string;
  getHighlightedText(): string;
  getTrimmedFullText(wordWindow?: number): string;
  getHighlightedSegments(): CardSegment[];
}

export class CardDocument {
  constructor(cards: Card[]);
  cards: Card[];
  getCards(): Card[];

  static fromXml(xmlString: string): CardDocument;
  static fromFile(filePath: string): Promise<CardDocument>;
  static fromFileSync(filePath: string): CardDocument;
}

export interface ParseDocxOptions {
  pocketFontSizeMin?: number;
  hatFontSizeMin?: number;
  blockFontSizeMin?: number;
  tagFontSizeMin?: number;
  tagFontSizeMax?: number;
  boldRatioThreshold?: number;
  heuristicTagBoldRatioMin?: number;
  heuristicTagLargeTextRatioMin?: number;
  shortUrlCiteMaxLength?: number;
  maxCiteParagraphs?: number;
  defaultPocketTitle?: string;
  defaultHatTitle?: string;
  defaultBlockTitle?: string;
}

export function parseDocx(
  filePath: string,
  options?: ParseDocxOptions
): Promise<{ file: any; warnings: string[] }>;

export function parseCaseDocx(
  filePath: string,
  options?: ParseDocxOptions
): Promise<{ file: any; warnings: string[]; xml: string }>;

export function toXml(fileNode: any): string;

export const DEFAULT_OPTIONS: Required<ParseDocxOptions>;

export function parseCardXml(xmlString: string): CardDocument;

export function parseCardXmlFile(filePath: string): Promise<CardDocument>;
