/**
 * Chatbot CLI Interface
 *
 * Command-line interface for interacting with the LSI chatbot.
 */

const Chatbot = require('./chatbot');
const readline = require('readline');

class ChatbotCLI {
  constructor() {
    this.chatbot = new Chatbot();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.conversationId = null;
  }

  /**
   * Start the CLI
   * @returns {Promise<void>}
   */
  async start() {
    console.log('\n🤖 LSI Chatbot');
    console.log('═'.repeat(50));
    console.log('Type "quit" to exit, "clear" to start new conversation\n');

    try {
      await this.chatbot.initialize();
      this.conversationId = this.chatbot.startConversation();
      this.prompt();
    } catch (error) {
      console.error('Failed to start chatbot:', error.message);
      process.exit(1);
    }
  }

  /**
   * Display prompt and handle user input
   */
  prompt() {
    this.rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === 'quit') {
        this.quit();
        return;
      }

      if (trimmed.toLowerCase() === 'clear') {
        this.conversationId = this.chatbot.startConversation();
        console.log('✓ Started new conversation\n');
        this.prompt();
        return;
      }

      if (trimmed.toLowerCase() === 'stats') {
        const stats = this.chatbot.getStats();
        console.log('\n📊 Stats:', JSON.stringify(stats, null, 2), '\n');
        this.prompt();
        return;
      }

      if (trimmed) {
        try {
          const result = await this.chatbot.processMessage(
            this.conversationId,
            trimmed
          );

          console.log(`\nBot: ${result.response}`);
          console.log(`[Intent: ${result.metadata.intent}, Confidence: ${result.metadata.confidence.toFixed(2)}]\n`);
        } catch (error) {
          console.error('\n✗ Error:', error.message, '\n');
        }
      }

      this.prompt();
    });
  }

  /**
   * Quit the CLI
   */
  quit() {
    console.log('\n👋 Goodbye!\n');
    this.chatbot.endConversation(this.conversationId);
    this.rl.close();
    process.exit(0);
  }
}

// Start CLI when run directly
if (require.main === module) {
  const cli = new ChatbotCLI();
  cli.start();
}

module.exports = ChatbotCLI;
