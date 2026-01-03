/**
 * Main Chatbot Class
 *
 * Orchestrates conversation management and response generation
 * for a complete chatbot experience.
 */

const { client, initialize } = require('./client');
const ConversationManager = require('./conversation');
const ResponseGenerator = require('./responder');

class Chatbot {
  constructor() {
    this.client = client;
    this.cm = null;
    this.responder = null;
    this.ready = false;
  }

  /**
   * Initialize chatbot
   * @returns {Promise<void>}
   */
  async initialize() {
    const success = await initialize();
    if (!success) {
      throw new Error('Failed to initialize LSI client');
    }

    this.cm = new ConversationManager(this.client);
    this.responder = new ResponseGenerator(this.client, this.cm);
    this.ready = true;

    console.log('✓ Chatbot ready');
  }

  /**
   * Process user message
   * @param {string} conversationId - Conversation ID
   * @param {string} userMessage - User's message
   * @returns {Promise<Object>} Response with metadata
   */
  async processMessage(conversationId, userMessage) {
    if (!this.ready) {
      throw new Error('Chatbot not initialized');
    }

    try {
      // Add user message to conversation
      await this.cm.addMessage(conversationId, 'user', userMessage);

      // Generate response
      const response = await this.responder.generateResponse(
        conversationId,
        userMessage
      );

      // Add assistant response to conversation
      await this.cm.addMessage(
        conversationId,
        'assistant',
        response.content,
        { intent: response.intent, confidence: response.confidence }
      );

      return {
        conversationId,
        response: response.content,
        metadata: {
          intent: response.intent,
          confidence: response.confidence,
          contextUsed: response.contextUsed
        }
      };

    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   * @param {string} conversationId - Conversation ID
   * @param {number} limit - Message limit
   * @returns {Array} Conversation history
   */
  getHistory(conversationId, limit = 10) {
    return this.cm.getHistory(conversationId, limit);
  }

  /**
   * Start new conversation
   * @returns {string} New conversation ID
   */
  startConversation() {
    const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return conversationId;
  }

  /**
   * End conversation
   * @param {string} conversationId - Conversation ID to end
   */
  endConversation(conversationId) {
    this.cm.clearConversation(conversationId);
  }

  /**
   * Get chatbot statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ready: this.ready,
      conversations: this.cm.conversations.size,
      totalMessages: Array.from(this.cm.conversations.values())
        .reduce((sum, conv) => sum + conv.messages.length, 0)
    };
  }
}

module.exports = Chatbot;
