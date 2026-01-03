/**
 * Chat command - Interactive chat mode
 */

import { Command } from "commander";
import { startChatRepl } from "../repl/index.js";

/**
 * Chat command _options
 */
export interface ChatOptions {
  /** Model to use */
  model?: string;
}

/**
 * Create chat command
 */
export function createChatCommand(): Command {
  const cmd = new Command("chat");

  cmd
    .description("Start interactive chat mode")
    .option("-m, --model <model>", "Model to use")
    .action(async (_options: ChatOptions) => {
      await startChatRepl();
    });

  return cmd;
}
