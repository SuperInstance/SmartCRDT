/**
 * Response Generator
 *
 * Generates chatbot responses based on user queries,
 * conversation context, and detected intents.
 */

class ResponseGenerator {
  constructor(client, conversationManager) {
    this.client = client;
    this.cm = conversationManager;
    this.templates = this.loadTemplates();
  }

  /**
   * Load response templates
   * @returns {Object} Template categories
   */
  loadTemplates() {
    return {
      greeting: [
        "Hello! How can I help you today?",
        "Hi there! What would you like to know?"
      ],
      clarification: [
        "Could you provide more details?",
        "I'd like to understand better. Can you elaborate?"
      ],
      fallback: [
        "I'm not sure I understand. Could you rephrase that?",
        "Let me make sure I understand correctly..."
      ],
      goodbye: [
        "Goodbye! Feel free to return anytime.",
        "Take care! Let me know if you need anything else."
      ]
    };
  }

  /**
   * Generate response based on query and context
   * @param {string} conversationId - Conversation ID
   * @param {string} userQuery - User's query
   * @returns {Promise<Object>} Response with metadata
   */
  async generateResponse(conversationId, userQuery) {
    // Get relevant context from conversation
    const relevantContext = await this.cm.getContext(conversationId, userQuery);

    // Build context string
    const contextStr = relevantContext
      .map(ctx => ctx.message.content)
      .join('\n');

    // Detect intent
    const intent = await this.detectIntent(userQuery);

    // Generate appropriate response
    let response;
    switch (intent.type) {
      case 'greeting':
        response = this.randomTemplate('greeting');
        break;
      case 'question':
        response = await this.answerQuestion(userQuery, contextStr);
        break;
      case 'goodbye':
        response = this.randomTemplate('goodbye');
        break;
      default:
        response = await this.generateContextualResponse(userQuery, contextStr);
    }

    return {
      content: response,
      intent: intent.type,
      confidence: intent.confidence,
      contextUsed: relevantContext.length
    };
  }

  /**
   * Detect user intent from query
   * @param {string} query - User query
   * @returns {Promise<Object>} Detected intent with confidence
   */
  async detectIntent(query) {
    const patterns = {
      greeting: /^(hi|hello|hey|greetings)/i,
      question: /\?|(what|how|why|when|where|who)/i,
      goodbye: /(bye|goodbye|see you|farewell)/i
    };

    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(query)) {
        return { type: intent, confidence: 0.9 };
      }
    }

    return { type: 'general', confidence: 0.5 };
  }

  /**
   * Answer question using context
   * @param {string} query - User query
   * @param {string} context - Conversation context
   * @returns {Promise<string>} Answer
   */
  async answerQuestion(query, context) {
    // In a full implementation, you'd use RAG here
    // For now, provide contextual responses
    const relevantInfo = context ? `\n\nContext: ${context}` : '';

    return `Based on our conversation${relevantInfo}, ` +
           `I understand you're asking about: "${query}". ` +
           `Let me help you with that.`;
  }

  /**
   * Generate contextual response
   * @param {string} query - User query
   * @param {string} context - Conversation context
   * @returns {Promise<string>} Contextual response
   */
  async generateContextualResponse(query, context) {
    if (!context) {
      return this.randomTemplate('fallback');
    }

    // Use semantic similarity to generate response
    const response = await this.client.generate({
      prompt: query,
      context: context,
      maxTokens: 150,
      temperature: 0.7
    });

    return response || this.randomTemplate('fallback');
  }

  /**
   * Get random template from category
   * @param {string} type - Template type
   * @returns {string} Random template
   */
  randomTemplate(type) {
    const templates = this.templates[type] || this.templates.fallback;
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

module.exports = ResponseGenerator;
