/**
 * Text Summarizer
 *
 * Generates summaries using extractive and abstractive methods.
 */

class TextSummarizer {
  constructor(lsiClient) {
    this.lsi = lsiClient;
  }

  /**
   * Generate summary
   * @param {Object} document - Document object
   * @param {Object} options - Summary options
   * @returns {Promise<Object>} Summary with metadata
   */
  async summarize(document, options = {}) {
    const {
      maxSummaryLength = 300,
      sentenceCount = 3,
      type = 'extractive' // or 'abstractive'
    } = options;

    const sentences = this.extractSentences(document.text);

    if (type === 'extractive') {
      return await this.extractiveSummary(sentences, sentenceCount);
    } else {
      return await this.abstractiveSummary(document, maxSummaryLength);
    }
  }

  /**
   * Extract sentences from text
   * @param {string} text - Document text
   * @returns {Array<Object>} Sentences with metadata
   */
  extractSentences(text) {
    // Simple sentence extraction using regex
    const sentenceRegex = /[.!?]+\s+/g;
    const sentences = text
      .split(sentenceRegex)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    return sentences.map((sentence, index) => ({
      text: sentence,
      index,
      position: index / sentences.length, // 0 to 1
      length: sentence.split(/\s+/).length
    }));
  }

  /**
   * Generate extractive summary
   * @param {Array} sentences - Sentences with metadata
   * @param {number} count - Number of sentences to extract
   * @returns {Promise<Object>} Extractive summary
   */
  async extractiveSummary(sentences, count) {
    // Score sentences by position, length, and importance
    const scored = await Promise.all(
      sentences.map(async (sentence) => {
        const score = await this.scoreSentence(sentence, sentences);
        return { ...sentence, score };
      })
    );

    // Sort by score and select top sentences
    const topSentences = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .sort((a, b) => a.index - b.index); // Preserve original order

    return {
      summary: topSentences.map(s => s.text).join('. ') + '.',
      sentences: topSentences,
      compressionRatio: topSentences.join('').length / sentences.join('').length,
      method: 'extractive'
    };
  }

  /**
   * Score a sentence's importance
   * @param {Object} sentence - Sentence with metadata
   * @param {Array} allSentences - All sentences in document
   * @returns {Promise<number>} Importance score
   */
  async scoreSentence(sentence, allSentences) {
    let score = 0;

    // Position bias (first and last sentences are important)
    if (sentence.position < 0.2) score += 0.3;
    if (sentence.position > 0.8) score += 0.2;

    // Length bias (medium length sentences are better)
    if (sentence.length >= 10 && sentence.length <= 30) {
      score += 0.2;
    }

    // Keyword importance
    const keywords = this.extractKeywords(sentence.text);
    score += Math.min(keywords.length * 0.05, 0.3);

    // Semantic similarity to other sentences
    const embedding = await this.lsi.embed(sentence.text);
    const similarities = await Promise.all(
      allSentences.map(async s => {
        if (s.index === sentence.index) return 0;
        const otherEmbedding = await this.lsi.embed(s.text);
        return this.lsi.similarity(embedding, otherEmbedding);
      })
    );

    // Average similarity indicates centrality
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    score += avgSimilarity * 0.5;

    return score;
  }

  /**
   * Extract keywords from sentence
   * @param {string} sentence - Sentence text
   * @returns {Array<string>} Keywords
   */
  extractKeywords(sentence) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being'
    ]);

    const words = sentence.text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    return words;
  }

  /**
   * Generate abstractive summary
   * @param {Object} document - Document object
   * @param {number} maxLength - Maximum summary length
   * @returns {Promise<Object>} Abstractive summary
   */
  async abstractiveSummary(document, maxLength) {
    // Use LSI to generate a new summary
    const chunks = this.chunkText(document.text, 500);

    let summary = '';
    for (const chunk of chunks) {
      const chunkSummary = await this.lsi.generate({
        prompt: `Summarize the following text concisely:\n\n${chunk}`,
        maxTokens: Math.floor(maxLength / chunks.length),
        temperature: 0.5
      });

      if (chunkSummary) {
        summary += chunkSummary + ' ';
      }
    }

    return {
      summary: summary.trim().substring(0, maxLength),
      method: 'abstractive',
      chunksProcessed: chunks.length
    };
  }

  /**
   * Split text into chunks
   * @param {string} text - Text to chunk
   * @param {number} size - Chunk size
   * @returns {Array<string>} Text chunks
   */
  chunkText(text, size) {
    const chunks = [];
    const words = text.split(/\s+/);

    for (let i = 0; i < words.length; i += size) {
      chunks.push(words.slice(i, i + size).join(' '));
    }

    return chunks;
  }

  /**
   * Generate bullet-point summary
   * @param {Object} document - Document object
   * @param {number} bulletCount - Number of bullet points
   * @returns {Promise<Object>} Bullet summary
   */
  async bulletSummary(document, bulletCount = 5) {
    const sentences = this.extractSentences(document.text);
    const { summary } = await this.extractiveSummary(sentences, bulletCount * 2);

    // Convert to bullet points
    const bullets = await Promise.all(
      sentences.slice(0, bulletCount).map(async (s) => {
        const embedding = await this.lsi.embed(s.text);
        return {
          text: s.text,
          importance: await this.scoreSentence(s, sentences)
        };
      })
    );

    return {
      bullets: bullets
        .sort((a, b) => b.importance - a.importance)
        .map(b => b.text)
        .slice(0, bulletCount)
    };
  }
}

module.exports = TextSummarizer;
