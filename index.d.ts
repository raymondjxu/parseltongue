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
  maxTagLength?: number;
  boldRatioThreshold?: number;
  heuristicTagBoldRatioMin?: number;
  heuristicTagLargeTextRatioMin?: number;
  shortUrlCiteMaxLength?: number;
  maxCiteParagraphs?: number;
  defaultPocketTitle?: string;
  defaultHatTitle?: string;
  defaultBlockTitle?: string;
}

export const DEFAULT_OPTIONS: Required<ParseDocxOptions>;

export function mergeOptions(user?: ParseDocxOptions): Required<ParseDocxOptions>;

export interface ParsedSegment {
  text: string;
  highlighted: boolean;
}

export interface ParsedParagraph {
  styleId: string | null;
  text: string;
  segments: ParsedSegment[];
  boldRatio: number;
  largeTextRatio: number;
  maxFontSize: number | null;
  hasHighlight: boolean;
  hasRed: boolean;
}

export type CardLevel = 'pocket' | 'hat' | 'block' | 'tag' | null;

export interface FileNode {
  type: 'file';
  children: Array<PocketNode | HatNode | BlockNode | CardNode>;
}

export interface PocketNode {
  type: 'pocket';
  title: string;
  children: Array<HatNode | BlockNode | CardNode>;
}

export interface HatNode {
  type: 'hat';
  title: string;
  children: Array<BlockNode | CardNode>;
}

export interface BlockNode {
  type: 'block';
  title: string;
  children: CardNode[];
}

export interface CardNode {
  type: 'card';
  tag: string;
  cite: string;
  cardTextSegments: CardSegment[];
  red: boolean;
  missingCite: boolean;
}

export interface ParseDocxResult {
  file: FileNode;
  warnings: string[];
}

export interface ParseCaseDocxResult extends ParseDocxResult {
  xml: string;
}

export function parseDocx(filePath: string, options?: ParseDocxOptions): Promise<ParseDocxResult>;
export function parseCaseDocx(
  filePath: string,
  options?: ParseDocxOptions
): Promise<ParseCaseDocxResult>;

export function toXml(fileNode: FileNode): string;

export function parseCardXml(xmlString: string): CardDocument;
export function parseCardXmlFile(filePath: string): Promise<CardDocument>;

// Lower-level building blocks

export function parseParagraph(paragraph: object, options?: ParseDocxOptions): ParsedParagraph;

export function extractParagraphsFromDocument(
  documentData: object,
  options: Required<ParseDocxOptions>
): ParsedParagraph[];

export function detectLevel(
  paragraph: ParsedParagraph,
  options: Required<ParseDocxOptions>,
  context?: { hasStrongBoldSignal?: boolean }
): CardLevel;

export function isCiteLine(text: string, options?: ParseDocxOptions): boolean;
export function isCiteContinuation(text: string): boolean;
export function containsUrlLikeToken(text: string): boolean;
export function joinCiteFragments(previous: string, next: string): string;
export function joinCiteLines(lines: string[]): string;
export function joinTagFragments(previous: string, next: string): string;
export function normalizeStyleId(styleId: string | null): string | null;

export class CardAssembler {
  constructor(options: Required<ParseDocxOptions>, context: { hasStrongBoldSignal: boolean });
  consume(paragraph: ParsedParagraph): void;
  finish(): ParseDocxResult;
}
