/**
 * ChatRepl - Interactive chat mode (REPL)
 */

import * as readline from "node:readline";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { CascadeRouter } from "@lsi/cascade";
import { createOllamaAdapter } from "@lsi/cascade";
import { formatDuration } from "../utils/formatting.js";

/**
 * REPL state
 */
interface ReplState {
  sessionId: string;
  currentModel: string;
  conversationHistory: { role: string; content: string }[];
  queryCount: number;
  totalTokens: number;
  totalCost: number;
  startTime: number;
}

/**
 * ChatRepl - Interactive chat REPL
 */
export class ChatRepl {
  private rl: readline.Interface;
  private router: CascadeRouter;
  private state: ReplState;
  private active = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan("aequor> "),
    });

    this.router = new CascadeRouter();
    this.state = this.initializeState();
  }

  /**
   * Initialize REPL state
   */
  private initializeState(): ReplState {
    return {
      sessionId: `session-${Date.now()}`,
      currentModel: "llama2:7b",
      conversationHistory: [],
      queryCount: 0,
      totalTokens: 0,
      totalCost: 0,
      startTime: Date.now(),
    };
  }

  /**
   * Start the REPL
   */
  async start(): Promise<void> {
    this.active = true;

    // Load configuration
    const _config = await configManager.getAll();
    this.state.currentModel = _config.defaultModel;

    // Print welcome message
    this.printWelcome();

    // Set up readline
    this.rl.prompt();

    // Handle input
    this.rl.on("line", async line => {
      await this.handleInput(line.trim());
      if (this.active) {
        this.rl.prompt();
      }
    });

    // Handle Ctrl+C
    this.rl.on("SIGINT", () => {
      this.rl.write("\n");
      this.handleExit();
    });

    // Handle Ctrl+D
    this.rl.on("close", () => {
      this.handleExit();
    });
  }

  /**
   * Print welcome message
   */
  private printWelcome(): void {
    console.log(
      chalk.cyan(
        "\n╔══════════════════════════════════════════════════════════════╗"
      )
    );
    console.log(
      chalk.cyan("║") +
        chalk.yellow("  Welcome to Aequor Chat") +
        "                                   " +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan("║") +
        "  Interactive AI orchestration platform                    " +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan(
        "╚══════════════════════════════════════════════════════════════╝"
      )
    );
    console.log(chalk.grey("\nType your message and press Enter to send."));
    console.log(
      chalk.grey("Type /help for available commands, /exit to quit.\n")
    );
  }

  /**
   * Handle input line
   */
  private async handleInput(line: string): Promise<void> {
    if (!line) {
      return;
    }

    // Check for commands
    if (line.startsWith("/")) {
      await this.handleCommand(line);
      return;
    }

    // Process as query
    await this.handleQuery(line);
  }

  /**
   * Handle query
   */
  private async handleQuery(query: string): Promise<void> {
    try {
      this.state.queryCount++;

      // Route query
      const decision = await this.router.route(query);

      // Show route info
      if (decision.route === "local") {
        process.stdout.write(
          chalk.grey("[") + chalk.green("local") + chalk.grey("] ")
        );
      } else {
        process.stdout.write(
          chalk.grey("[") + chalk.blue("cloud") + chalk.grey("] ")
        );
      }

      // Execute query
      const startTime = Date.now();

      if (decision.route === "local") {
        await this.executeLocalQuery(query);
      } else {
        await this.executeCloudQuery(query);
      }

      const latency = Date.now() - startTime;

      // Show timing if _verbose
      console.log(chalk.grey(`\n[${formatDuration(latency)}]`));

      // Add to history
      this.state.conversationHistory.push({ role: "user", content: query });
    } catch (error) {
      logger.error(`Query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute local query
   */
  private async executeLocalQuery(query: string): Promise<void> {
    const _config = await configManager.getBackendConfig();
    const adapter = createOllamaAdapter(
      _config.localUrl || "http://localhost:11434",
      this.state.currentModel,
      {
        timeout: 30000,
        maxRetries: 3,
        stream: false,
      }
    );

    const result = await adapter.process(query, this.state.currentModel);

    console.log(result.content);
    this.state.conversationHistory.push({
      role: "assistant",
      content: result.content,
    });

    if (result.tokensUsed) {
      this.state.totalTokens += result.tokensUsed;
    }
  }

  /**
   * Execute cloud query (placeholder)
   */
  private async executeCloudQuery(query: string): Promise<void> {
    console.log(
      chalk.yellow("Cloud backend integration pending. Query would be sent to:")
    );
    console.log(chalk.grey(`  Model: ${this.state.currentModel}`));
    console.log(chalk.grey(`  Query: ${query}`));
  }

  /**
   * Handle command
   */
  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.split(" ");
    const cmdLower = cmd.toLowerCase();

    switch (cmdLower) {
      case "/help":
        this.showHelp();
        break;
      case "/exit":
      case "/quit":
        this.handleExit();
        break;
      case "/clear":
        console.clear();
        this.printWelcome();
        break;
      case "/model":
        await this.handleModelCommand(args);
        break;
      case "/status":
        await this.showStatus();
        break;
      case "/history":
        this.showHistory();
        break;
      case "/reset":
        this.resetConversation();
        break;
      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
        console.log(chalk.grey("Type /help for available commands"));
    }
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log(chalk.cyan("\nAvailable Commands:\n"));

    const commands = [
      ["/help", "Show this help message"],
      ["/exit, /quit", "Exit chat mode"],
      ["/clear", "Clear screen"],
      ["/model [name]", "Show or set current model"],
      ["/status", "Show session status"],
      ["/history", "Show conversation history"],
      ["/reset", "Reset conversation"],
    ];

    for (const [cmd, desc] of commands) {
      console.log(chalk.yellow(cmd.padEnd(20)) + chalk.grey(desc));
    }

    console.log();
  }

  /**
   * Handle model command
   */
  private async handleModelCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(
        chalk.yellow(`\nCurrent model: ${this.state.currentModel}\n`)
      );
      return;
    }

    const newModel = args[0];
    this.state.currentModel = newModel;
    console.log(chalk.green(`Model changed to: ${newModel}\n`));
  }

  /**
   * Show status
   */
  private async showStatus(): Promise<void> {
    const uptime = Date.now() - this.state.startTime;

    console.log(chalk.cyan("\nSession Status:\n"));
    console.log(`  Session ID: ${this.state.sessionId}`);
    console.log(`  Model: ${this.state.currentModel}`);
    console.log(`  Queries: ${this.state.queryCount}`);
    console.log(`  Tokens: ${this.state.totalTokens}`);
    console.log(`  Uptime: ${formatDuration(uptime)}`);
    console.log(`  Messages: ${this.state.conversationHistory.length}`);
    console.log();
  }

  /**
   * Show history
   */
  private showHistory(): void {
    console.log(chalk.cyan("\nConversation History:\n"));

    if (this.state.conversationHistory.length === 0) {
      console.log(chalk.grey("  No messages yet\n"));
      return;
    }

    for (const msg of this.state.conversationHistory) {
      const role =
        msg.role === "user" ? chalk.green("You") : chalk.blue("Assistant");
      console.log(
        `${role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`
      );
    }

    console.log();
  }

  /**
   * Reset conversation
   */
  private resetConversation(): void {
    this.state.conversationHistory = [];
    this.state.queryCount = 0;
    this.state.totalTokens = 0;
    this.router.resetSession();
    console.log(chalk.green("Conversation reset\n"));
  }

  /**
   * Handle exit
   */
  private handleExit(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.rl.close();

    const uptime = Date.now() - this.state.startTime;

    console.log(
      chalk.cyan(
        "\n╔══════════════════════════════════════════════════════════════╗"
      )
    );
    console.log(
      chalk.cyan("║") + "  Session Summary" + " ".repeat(46) + chalk.cyan("║")
    );
    console.log(
      chalk.cyan(
        "╠══════════════════════════════════════════════════════════════╣"
      )
    );
    console.log(
      chalk.cyan("║") +
        `  Queries:    ${this.state.queryCount}` +
        " ".repeat(43) +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan("║") +
        `  Tokens:     ${this.state.totalTokens}` +
        " ".repeat(43) +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan("║") +
        `  Messages:   ${this.state.conversationHistory.length}` +
        " ".repeat(40) +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan("║") +
        `  Uptime:     ${formatDuration(uptime)}` +
        " ".repeat(42) +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan(
        "╚══════════════════════════════════════════════════════════════╝"
      )
    );
    console.log(chalk.grey("\nThank you for using Aequor!\n"));

    process.exit(0);
  }
}

/**
 * Start chat REPL
 */
export async function startChatRepl(): Promise<void> {
  const repl = new ChatRepl();
  await repl.start();
}
