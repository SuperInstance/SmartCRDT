/**
 * Document Parser
 *
 * Parses various document formats including PDF, Word,
 * plain text, and Markdown files.
 */

const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentParser {
  constructor() {
    this.supportedFormats = {
      '.pdf': 'parsePDF',
      '.docx': 'parseWord',
      '.doc': 'parseWord',
      '.txt': 'parseText',
      '.md': 'parseText'
    };
  }

  /**
   * Parse document based on extension
   * @param {string} filePath - Path to document
   * @returns {Promise<Object>} Parsed document
   */
  async parse(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (!this.supportedFormats[ext]) {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    const parserMethod = this[this.supportedFormats[ext]];
    const result = await parserMethod.call(this, filePath);

    return {
      path: filePath,
      format: ext.slice(1),
      text: result.text,
      metadata: result.metadata || {},
      pageCount: result.pageCount || 1,
      wordCount: this.countWords(result.text)
    };
  }

  /**
   * Parse PDF files
   * @param {string} filePath - Path to PDF
   * @returns {Promise<Object>} Parsed PDF data
   */
  async parsePDF(filePath) {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator
      },
      pageCount: data.numpages
    };
  }

  /**
   * Parse Word documents
   * @param {string} filePath - Path to document
   * @returns {Promise<Object>} Parsed Word data
   */
  async parseWord(filePath) {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      metadata: {
        messages: result.messages
      }
    };
  }

  /**
   * Parse plain text and markdown
   * @param {string} filePath - Path to text file
   * @returns {Promise<Object>} Parsed text data
   */
  async parseText(filePath) {
    const text = await fs.readFile(filePath, 'utf-8');
    return { text };
  }

  /**
   * Count words in text
   * @param {string} text - Text content
   * @returns {number} Word count
   */
  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Split text into chunks for processing
   * @param {string} text - Text content
   * @param {number} maxChunkSize - Maximum words per chunk
   * @param {number} overlap - Overlapping words between chunks
   * @returns {Array<string>} Text chunks
   */
  chunkText(text, maxChunkSize = 1000, overlap = 100) {
    const chunks = [];
    const words = text.split(/\s+/);
    let currentChunk = [];

    for (const word of words) {
      currentChunk.push(word);

      if (currentChunk.length >= maxChunkSize) {
        chunks.push(currentChunk.join(' '));
        // Keep overlapping words for context
        currentChunk = currentChunk.slice(-overlap);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  /**
   * Clean and normalize text
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }
}

module.exports = DocumentParser;
