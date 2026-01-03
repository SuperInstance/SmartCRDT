/**
 * Conversation Manager
 *
 * Manages chat conversations including history tracking,
 * context management, and semantic search within conversations.
 */

class ConversationManager {
  constructor(client) {
    this.client = client;
    this.conversations = new Map();
    this.maxHistory = 50; // Max messages per conversation
  }

  /**
   * Start or continue a conversation
   * @param {string} conversationId - Unique conversation identifier
   * @returns {Promise<Object>} Conversation object
   */
  async getConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        id: conversationId,
        messages: [],
        context: new Map(),
        createdAt: Date.now()
      });
    }
    return this.conversations.get(conversationId);
  }

  /**
   * Add message to conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} role - Message role ('user' or 'assistant')
   * @param {string} content - Message content
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Added message
   */
  async addMessage(conversationId, role, content, metadata = {}) {
    const conversation = await this.getConversation(conversationId);

    const message = {
      id: `${conversationId}-${conversation.messages.length}`,
      role, // 'user' or 'assistant'
      content,
      timestamp: Date.now(),
      metadata
    };

    conversation.messages.push(message);

    // Trim if exceeds max history
    if (conversation.messages.length > this.maxHistory) {
      conversation.messages = conversation.messages.slice(-this.maxHistory);
    }

    // Store semantic context for user messages
    if (role === 'user') {
      const embedding = await this.client.embed(content);
      conversation.context.set(message.id, embedding);
    }

    return message;
  }

  /**
   * Get conversation history
   * @param {string} conversationId - Conversation ID
   * @param {number} limit - Number of messages to retrieve
   * @returns {Array} Message history
   */
  getHistory(conversationId, limit = 10) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];
    return conversation.messages.slice(-limit);
  }

  /**
   * Get semantic context for a query
   * @param {string} conversationId - Conversation ID
   * @param {string} query - Query to find context for
   * @param {number} topK - Number of context items to return
   * @returns {Promise<Array>} Relevant context with similarity scores
   */
  async getContext(conversationId, query, topK = 5) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];

    const queryEmbedding = await this.client.embed(query);
    const contexts = [];

    for (const [msgId, embedding] of conversation.context) {
      const similarity = this.client.similarity(queryEmbedding, embedding);
      const message = conversation.messages.find(m => m.id === msgId);

      if (message && similarity > 0.5) {
        contexts.push({
          message,
          similarity
        });
      }
    }

    return contexts
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Clear a conversation
   * @param {string} conversationId - Conversation ID to clear
   */
  clearConversation(conversationId) {
    this.conversations.delete(conversationId);
  }
}

module.exports = ConversationManager;
