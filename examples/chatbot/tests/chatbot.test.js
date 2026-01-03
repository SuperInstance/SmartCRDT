/**
 * Chatbot Tests
 *
 * Test suite for the chatbot functionality
 */

const Chatbot = require('../src/chatbot');

describe('Chatbot', () => {
  let chatbot;
  let conversationId;

  beforeAll(async () => {
    chatbot = new Chatbot();
    await chatbot.initialize();
  });

  beforeEach(() => {
    conversationId = chatbot.startConversation();
  });

  afterEach(() => {
    chatbot.endConversation(conversationId);
  });

  test('should respond to greeting', async () => {
    const result = await chatbot.processMessage(conversationId, 'Hello');
    expect(result.response).toBeTruthy();
    expect(result.metadata.intent).toBe('greeting');
  });

  test('should maintain conversation context', async () => {
    await chatbot.processMessage(conversationId, 'My name is Alice');
    const history = chatbot.getHistory(conversationId);
    expect(history.length).toBe(2); // user + assistant
  });

  test('should handle questions', async () => {
    const result = await chatbot.processMessage(conversationId, 'What is this?');
    expect(result.metadata.intent).toBe('question');
  });

  test('should handle goodbye', async () => {
    const result = await chatbot.processMessage(conversationId, 'Goodbye');
    expect(result.metadata.intent).toBe('goodbye');
  });

  test('should track statistics', () => {
    const stats = chatbot.getStats();
    expect(stats.ready).toBe(true);
    expect(stats.conversations).toBeGreaterThan(0);
  });
});
