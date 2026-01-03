/**
 * @lsi/vljepa/y-encoder/TextTokenizer - Text Tokenization for Y-Encoder
 *
 * This module implements text tokenization for the Y-Encoder (Language Encoder).
 * It provides BPE (Byte-Pair Encoding) tokenization with support for UI-specific
 * vocabulary and special tokens.
 *
 * ## Tokenization
 *
 * 1. **Preprocessing**: Lowercase, normalize whitespace
 * 2. **BPE Merge**: Apply learned merge rules
 * 3. **Special Tokens**: Add CLS, SEP, PAD, UNK tokens
 * 4. **Truncation/Padding**: Handle sequence length limits
 *
 * ## UI-Specific Vocabulary
 *
 * The tokenizer is optimized for UI-related text:
 * - CSS properties and values
 * - HTML element names
 * - Common UI commands
 * - Layout terms
 *
 * @version 1.0.0
 */

import type { YEncoderConfig } from "../protocol.js";

/**
 * Special token IDs
 */
export enum SpecialToken {
  /** Classification token - added at start */
  CLS = 0,

  /** Separator token - separates segments */
  SEP = 1,

  /** Padding token - for batch padding */
  PAD = 2,

  /** Unknown token - for out-of-vocabulary words */
  UNK = 3,

  /** Mask token - for masked language modeling */
  MASK = 4,

  /** First special token ID (offset for regular tokens) */
  FIRST_SPECIAL = 0,
}

/**
 * Special token strings
 */
export const SPECIAL_TOKEN_STRINGS: Record<SpecialToken, string> = {
  [SpecialToken.CLS]: "[CLS]",
  [SpecialToken.SEP]: "[SEP]",
  [SpecialToken.PAD]: "[PAD]",
  [SpecialToken.UNK]: "[UNK]",
  [SpecialToken.MASK]: "[MASK]",
};

/**
 * Tokenizer configuration
 */
export interface TokenizerConfig {
  /** Vocabulary size */
  vocabSize: number;

  /** Maximum token sequence length */
  maxLength: number;

  /** Whether to lowercase input */
  lowercase?: boolean;

  /** Whether to normalize whitespace */
  normalizeWhitespace?: boolean;

  /** Whether to add special tokens */
  addSpecialTokens?: boolean;

  /** BPE merge operations */
  mergeRules?: Map<string, number>;

  /** Character to subword mappings */
  vocab?: Map<string, number>;
}

/**
 * Tokenization result
 */
export interface TokenizationResult {
  /** Token IDs */
  tokenIds: number[];

  /** Tokens (strings) */
  tokens: string[];

  /** Attention mask (1 for real tokens, 0 for padding) */
  attentionMask: number[];

  /** Special token positions */
  specialTokenPositions?: Map<SpecialToken, number>;
}

/**
 * BPE merge operation
 */
interface BPEMerge {
  /** Pair to merge */
  pair: string;

  /** Priority (lower = higher priority) */
  priority: number;

  /** Resulting token */
  result: string;
}

/**
 * TextTokenizer - BPE Tokenizer for Y-Encoder
 *
 * Implements Byte-Pair Encoding tokenization with support for
 * UI-specific vocabulary and special tokens.
 *
 * ## BPE Algorithm
 *
 * 1. Start with character-level vocabulary
 * 2. Iteratively merge most frequent pair
 * 3. Continue until vocabulary size reached
 *
 * ## Special Tokens
 *
 * - `[CLS]`: Classification token (start of sequence)
 * - `[SEP]`: Separator token (between segments)
 * - `[PAD]`: Padding token (for batching)
 * - `[UNK]`: Unknown token (out-of-vocabulary)
 * - `[MASK]`: Mask token (for training)
 *
 * @example
 * ```typescript
 * const tokenizer = new TextTokenizer({
 *   vocabSize: 50000,
 *   maxLength: 512,
 *   lowercase: true,
 *   addSpecialTokens: true
 * });
 *
 * const result = tokenizer.tokenize("Make this button pop");
 * console.log(result.tokens); // ['[CLS]', 'make', 'this', 'button', 'pop', '[SEP]']
 * console.log(result.tokenIds); // [0, 1234, 567, 890, 234, 1]
 * ```
 */
export class TextTokenizer {
  /** Configuration */
  private config: Required<TokenizerConfig>;

  /** Vocabulary: token string -> ID */
  private vocab: Map<string, number>;

  /** Reverse vocabulary: ID -> token string */
  private idToToken: Map<number, string>;

  /** BPE merge rules: pair string -> priority */
  private mergeRules: Map<string, number>;

  /** Whether tokenizer is initialized */
  private initialized: boolean = false;

  /** UI-specific vocabulary tokens */
  private static readonly UI_VOCABULARY = [
    // CSS properties
    "display",
    "flex",
    "grid",
    "block",
    "inline",
    "none",
    "position",
    "absolute",
    "relative",
    "fixed",
    "sticky",
    "margin",
    "padding",
    "border",
    "background",
    "color",
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    "justify-content",
    "align-items",
    "flex-direction",
    "grid-template",
    "gap",
    "overflow",
    "z-index",

    // HTML elements
    "div",
    "span",
    "button",
    "input",
    "form",
    "img",
    "header",
    "footer",
    "nav",
    "main",
    "section",
    "article",
    "ul",
    "ol",
    "li",
    "table",
    "tr",
    "td",
    "th",

    // UI commands
    "center",
    "align",
    "resize",
    "move",
    "delete",
    "create",
    "modify",
    "change",
    "update",
    "style",
    "format",

    // Layout terms
    "container",
    "wrapper",
    "row",
    "column",
    "sidebar",
    "navbar",
    "hero",
    "card",
    "modal",
    "dropdown",

    // Colors
    "red",
    "blue",
    "green",
    "yellow",
    "orange",
    "purple",
    "black",
    "white",
    "gray",
    "pink",
    "cyan",
    "magenta",

    // Common UI phrases
    "make this",
    "change the",
    "set to",
    "align to",
    "move to",
    "resize to",
    "center this",
    "left align",
  ];

  /**
   * Create a text tokenizer
   *
   * @param config - Tokenizer configuration
   */
  constructor(config: TokenizerConfig) {
    this.config = {
      vocabSize: config.vocabSize,
      maxLength: config.maxLength,
      lowercase: config.lowercase ?? true,
      normalizeWhitespace: config.normalizeWhitespace ?? true,
      addSpecialTokens: config.addSpecialTokens ?? true,
      mergeRules: config.mergeRules ?? new Map(),
      vocab: config.vocab ?? new Map(),
    };

    this.vocab = new Map(this.config.vocab);
    this.idToToken = new Map();
    this.mergeRules = new Map(this.config.mergeRules);
  }

  /**
   * Initialize the tokenizer
   *
   * Builds vocabulary with special tokens and UI-specific terms.
   * Must be called before tokenize().
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Add special tokens
    for (const [id, token] of Object.entries(SPECIAL_TOKEN_STRINGS)) {
      const tokenId = parseInt(id, 10);
      this.vocab.set(token, tokenId);
      this.idToToken.set(tokenId, token);
    }

    // Add UI-specific vocabulary
    let nextId = SpecialToken.MASK + 1;
    for (const token of TextTokenizer.UI_VOCABULARY) {
      if (!this.vocab.has(token) && nextId < this.config.vocabSize) {
        this.vocab.set(token, nextId);
        this.idToToken.set(nextId, token);
        nextId++;
      }
    }

    // Add common subwords (character bigrams and trigrams)
    const commonSubwords = this.generateCommonSubwords();
    for (const subword of commonSubwords) {
      if (!this.vocab.has(subword) && nextId < this.config.vocabSize) {
        this.vocab.set(subword, nextId);
        this.idToToken.set(nextId, subword);
        nextId++;
      }
    }

    // Build reverse vocabulary
    this.buildReverseVocabulary();

    // Initialize BPE merge rules
    this.initializeBPEMergeRules();

    this.initialized = true;
  }

  /**
   * Tokenize text
   *
   * @param text - Text to tokenize
   * @returns Tokenization result
   */
  tokenize(text: string): TokenizationResult {
    if (!this.initialized) {
      this.initialize();
    }

    // Preprocess text
    let processed = this.preprocess(text);

    // Split into words
    const words = processed.split(/\s+/).filter(w => w.length > 0);

    // Apply BPE to each word
    const tokens: string[] = [];
    for (const word of words) {
      const subwords = this.applyBPE(word);
      tokens.push(...subwords);
    }

    // Add special tokens
    const specialTokenPositions = new Map<SpecialToken, number>();
    if (this.config.addSpecialTokens) {
      tokens.unshift(SPECIAL_TOKEN_STRINGS[SpecialToken.CLS]);
      tokens.push(SPECIAL_TOKEN_STRINGS[SpecialToken.SEP]);
      specialTokenPositions.set(SpecialToken.CLS, 0);
      specialTokenPositions.set(SpecialToken.SEP, tokens.length - 1);
    }

    // Truncate if necessary
    const maxTokens = this.config.maxLength;
    let finalTokens = tokens;
    if (tokens.length > maxTokens) {
      // Keep special tokens and truncate middle
      if (this.config.addSpecialTokens) {
        const keepStart = Math.floor((maxTokens - 2) / 2);
        const keepEnd = maxTokens - 2 - keepStart;
        finalTokens = [
          ...tokens.slice(0, keepStart + 1), // +1 for CLS
          ...tokens.slice(-keepEnd - 1), // -1 for SEP
        ];
        specialTokenPositions.set(SpecialToken.SEP, finalTokens.length - 1);
      } else {
        finalTokens = tokens.slice(0, maxTokens);
      }
    }

    // Convert to token IDs
    const tokenIds = this.tokensToIds(finalTokens);

    // Create attention mask
    const attentionMask = new Array(tokenIds.length).fill(1);

    return {
      tokenIds,
      tokens: finalTokens,
      attentionMask,
      specialTokenPositions:
        specialTokenPositions.size > 0 ? specialTokenPositions : undefined,
    };
  }

  /**
   * Convert tokens to IDs
   *
   * @param tokens - Token strings
   * @returns Token IDs
   */
  tokensToIds(tokens: string[]): number[] {
    const ids: number[] = [];

    for (const token of tokens) {
      const id = this.vocab.get(token);
      if (id !== undefined) {
        ids.push(id);
      } else {
        // Use UNK token for unknown words
        ids.push(SpecialToken.UNK);
      }
    }

    return ids;
  }

  /**
   * Convert IDs back to tokens
   *
   * @param ids - Token IDs
   * @returns Token strings
   */
  idsToTokens(ids: number[]): string[] {
    const tokens: string[] = [];

    for (const id of ids) {
      const token = this.idToToken.get(id);
      if (token !== undefined) {
        tokens.push(token);
      } else {
        tokens.push(SPECIAL_TOKEN_STRINGS[SpecialToken.UNK]);
      }
    }

    return tokens;
  }

  /**
   * Decode token IDs back to text
   *
   * @param ids - Token IDs
   * @param skipSpecialTokens - Whether to skip special tokens
   * @returns Decoded text
   */
  decode(ids: number[], skipSpecialTokens: boolean = true): string {
    let tokens = this.idsToTokens(ids);

    // Remove special tokens if requested
    if (skipSpecialTokens) {
      const specialTokens = Object.values(SPECIAL_TOKEN_STRINGS);
      tokens = tokens.filter(t => !specialTokens.includes(t));
    }

    // Remove ## prefix from BPE subwords (continuation pieces)
    tokens = tokens.map(t => t.replace(/^##/g, ""));

    return tokens
      .join(" ")
      .replace(/\s+([.,!?;])/g, "$1")
      .trim();
  }

  /**
   * Preprocess text
   *
   * @param text - Input text
   * @returns Preprocessed text
   */
  private preprocess(text: string): string {
    let processed = text;

    // Lowercase if configured
    if (this.config.lowercase) {
      processed = processed.toLowerCase();
    }

    // Normalize whitespace if configured
    if (this.config.normalizeWhitespace) {
      processed = processed.replace(/\s+/g, " ").trim();
    }

    return processed;
  }

  /**
   * Apply BPE to a word
   *
   * @param word - Word to tokenize
   * @returns Subword tokens
   */
  private applyBPE(word: string): string[] {
    // Check if word is in vocabulary
    if (this.vocab.has(word)) {
      return [word];
    }

    // Split into characters
    let subwords = word.split("").map(c => (this.vocab.has(c) ? c : "<unk>"));

    // Apply merge rules until no more merges possible
    let merged = true;
    while (merged && subwords.length > 1) {
      merged = false;
      let bestPair: [string, string] | null = null;
      let bestPriority = Infinity;

      // Find best merge pair
      for (let i = 0; i < subwords.length - 1; i++) {
        const pair = `${subwords[i]} ${subwords[i + 1]}`;
        const priority = this.mergeRules.get(pair);

        if (priority !== undefined && priority < bestPriority) {
          bestPriority = priority;
          bestPair = [subwords[i], subwords[i + 1]];
        }
      }

      // Apply merge
      if (bestPair) {
        const mergedToken = bestPair[0] + bestPair[1];
        const newSubwords: string[] = [];
        let i = 0;

        while (i < subwords.length) {
          if (
            i < subwords.length - 1 &&
            subwords[i] === bestPair[0] &&
            subwords[i + 1] === bestPair[1]
          ) {
            newSubwords.push(mergedToken);
            i += 2;
          } else {
            newSubwords.push(subwords[i]);
            i++;
          }
        }

        subwords = newSubwords;
        merged = true;
      }
    }

    // Mark continuation pieces with ##
    for (let i = 1; i < subwords.length; i++) {
      if (!subwords[i].startsWith("##")) {
        subwords[i] = "##" + subwords[i];
      }
    }

    return subwords;
  }

  /**
   * Generate common subwords
   *
   * Generates character bigrams and trigrams from UI vocabulary.
   *
   * @returns Common subwords
   */
  private generateCommonSubwords(): string[] {
    const subwords: Set<string> = new Set();

    for (const word of TextTokenizer.UI_VOCABULARY) {
      // Add character bigrams
      for (let i = 0; i < word.length - 1; i++) {
        subwords.add(word.substring(i, i + 2));
      }

      // Add character trigrams
      for (let i = 0; i < word.length - 2; i++) {
        subwords.add(word.substring(i, i + 3));
      }

      // Add common suffixes/prefixes
      if (word.endsWith("ing")) subwords.add("ing");
      if (word.endsWith("ed")) subwords.add("ed");
      if (word.endsWith("tion")) subwords.add("tion");
      if (word.startsWith("un")) subwords.add("un");
      if (word.startsWith("re")) subwords.add("re");
    }

    return Array.from(subwords);
  }

  /**
   * Initialize BPE merge rules
   *
   * Creates simple merge rules based on character frequency.
   */
  private initializeBPEMergeRules(): void {
    // Merge common letter pairs
    const commonPairs = [
      "th",
      "he",
      "in",
      "er",
      "an",
      "re",
      "on",
      "at",
      "en",
      "nd",
      "ti",
      "es",
      "or",
      "te",
      "of",
      "ed",
      "is",
      "it",
      "al",
      "ar",
      "st",
      "to",
      "nt",
      "ng",
      "se",
      "ha",
      "as",
      "ou",
      "io",
      "le",
      "ve",
      "co",
      "me",
      "de",
      "hi",
      "si",
      "nc",
      "ea",
      "fo",
      "rt",
    ];

    let priority = 0;
    for (const pair of commonPairs) {
      const chars = pair.split("");
      this.mergeRules.set(`${chars[0]} ${chars[1]}`, priority++);
    }
  }

  /**
   * Build reverse vocabulary (ID -> token)
   */
  private buildReverseVocabulary(): void {
    this.idToToken.clear();

    for (const [token, id] of this.vocab) {
      this.idToToken.set(id, token);
    }
  }

  /**
   * Get vocabulary size
   */
  getVocabSize(): number {
    return this.vocab.size;
  }

  /**
   * Check if token exists in vocabulary
   *
   * @param token - Token string
   * @returns Whether token exists
   */
  hasToken(token: string): boolean {
    return this.vocab.has(token);
  }

  /**
   * Get special token ID
   *
   * @param token - Special token type
   * @returns Token ID
   */
  getSpecialTokenId(token: SpecialToken): number {
    return token;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<TokenizerConfig> {
    return { ...this.config };
  }

  /**
   * Get vocabulary (for export)
   *
   * @returns Vocabulary map
   */
  getVocabulary(): Map<string, number> {
    return new Map(this.vocab);
  }

  /**
   * Set vocabulary (for loading)
   *
   * @param vocab - Vocabulary map
   */
  setVocabulary(vocab: Map<string, number>): void {
    this.vocab = new Map(vocab);
    this.buildReverseVocabulary();
  }

  /**
   * Reset the tokenizer
   */
  reset(): void {
    this.initialized = false;
    this.vocab.clear();
    this.idToToken.clear();
    this.mergeRules.clear();
  }
}

/**
 * Create a tokenizer from Y-Encoder configuration
 *
 * @param config - Y-Encoder configuration
 * @returns Text tokenizer
 */
export function createTokenizer(config: YEncoderConfig): TextTokenizer {
  const tokenizerConfig: TokenizerConfig = {
    vocabSize: config.vocabSize,
    maxLength: config.contextLength,
    lowercase: config.tokenizer?.lowercase ?? true,
    normalizeWhitespace: true,
    addSpecialTokens: true,
  };

  return new TextTokenizer(tokenizerConfig);
}

/**
 * Get the count of special tokens
 */
export function getSpecialTokenCount(): number {
  return Object.keys(SPECIAL_TOKEN_STRINGS).length;
}
