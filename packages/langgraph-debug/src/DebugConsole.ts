/**
 * Debug Console for LangGraph
 *
 * Provides an interactive REPL for inspecting and modifying
 * execution state during debugging.
 */

import type {
  ConsoleCommand,
  DebugConsoleContext,
  ExecutionTrace,
  DebugSession,
} from "./types.js";

/**
 * Console command handler type
 */
type CommandHandler = (
  args: string[],
  context: DebugConsoleContext
) => Promise<unknown> | unknown;

/**
 * Debug Console Class
 *
 * Interactive REPL for debugging agent workflows.
 */
export class DebugConsole {
  private context: DebugConsoleContext;
  private commandHistory: ConsoleCommand[] = [];
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private commandAliases: Map<string, string> = new Map();
  private outputCallback: ((output: string) => void) | null = null;

  constructor(initialContext?: Partial<DebugConsoleContext>) {
    this.context = {
      current_state: {},
      available_commands: [],
      variables: {},
      ...initialContext,
    };

    this.registerDefaultCommands();
  }

  /**
   * Register default console commands
   */
  private registerDefaultCommands(): void {
    this.registerCommand("help", this.helpCommand.bind(this), ["h", "?"]);
    this.registerCommand("state", this.stateCommand.bind(this), ["s"]);
    this.registerCommand("get", this.getCommand.bind(this), ["g"]);
    this.registerCommand("set", this.setCommand.bind(this));
    this.registerCommand("trace", this.traceCommand.bind(this), ["t"]);
    this.registerCommand("inspect", this.inspectCommand.bind(this), ["i"]);
    this.registerCommand("continue", this.continueCommand.bind(this), ["c"]);
    this.registerCommand("step", this.stepCommand.bind(this));
    this.registerCommand("next", this.nextCommand.bind(this), ["n"]);
    this.registerCommand("break", this.breakCommand.bind(this), ["b"]);
    this.registerCommand("watch", this.watchCommand.bind(this), ["w"]);
    this.registerCommand("clear", this.clearCommand.bind(this));
    this.registerCommand("history", this.historyCommand.bind(this));
    this.registerCommand("vars", this.varsCommand.bind(this), ["v"]);
    this.registerCommand("eval", this.evalCommand.bind(this), ["e"]);
    this.registerCommand("backtrace", this.backtraceCommand.bind(this), ["bt"]);
    this.registerCommand("quit", this.quitCommand.bind(this), ["q", "exit"]);
  }

  /**
   * Register a new console command
   */
  registerCommand(
    name: string,
    handler: CommandHandler,
    aliases: string[] = []
  ): void {
    this.commandHandlers.set(name.toLowerCase(), handler);
    for (const alias of aliases) {
      this.commandAliases.set(alias.toLowerCase(), name.toLowerCase());
    }

    if (!this.context.available_commands.includes(name)) {
      this.context.available_commands.push(name);
    }
  }

  /**
   * Execute a console command
   */
  async executeCommand(command: string): Promise<unknown> {
    const trimmed = command.trim();
    if (!trimmed) {
      return null;
    }

    // Handle shell commands (starting with !)
    if (trimmed.startsWith("!")) {
      return this.executeShellCommand(trimmed.slice(1));
    }

    const parts = this.parseCommand(trimmed);
    const commandName = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    // Resolve aliases
    const resolvedCommand = this.commandAliases.get(commandName) ?? commandName;

    const startTime = Date.now();
    let result: unknown;
    let error: Error | undefined;

    try {
      const handler = this.commandHandlers.get(resolvedCommand);
      if (!handler) {
        throw new Error(`Unknown command: ${commandName}`);
      }

      result = await handler(args, this.context);
    } catch (err) {
      error = err as Error;
      result = error;
    }

    const duration = Date.now() - startTime;

    // Record command in history
    const cmd: ConsoleCommand = {
      command_id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      command: trimmed,
      args,
      timestamp: Date.now(),
      result: error ? undefined : result,
      error,
      duration_ms: duration,
    };
    this.commandHistory.push(cmd);

    // Limit history size
    if (this.commandHistory.length > 1000) {
      this.commandHistory.shift();
    }

    // Output result
    if (this.outputCallback) {
      this.outputCallback(this.formatOutput(result, error));
    }

    return result;
  }

  /**
   * Parse command string into parts
   */
  private parseCommand(command: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let escape = false;

    for (const char of command) {
      if (escape) {
        current += char;
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === " " && !inQuotes) {
        if (current) {
          parts.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Execute shell command
   */
  private async executeShellCommand(command: string): Promise<string> {
    throw new Error(`Shell commands not supported: !${command}`);
  }

  /**
   * Format command output
   */
  private formatOutput(result: unknown, error?: Error): string {
    if (error) {
      return `Error: ${error.message}`;
    }

    if (result === undefined || result === null) {
      return "";
    }

    if (typeof result === "object") {
      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }

  /**
   * Update console context
   */
  updateContext(updates: Partial<DebugConsoleContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Get current context
   */
  getContext(): DebugConsoleContext {
    return { ...this.context };
  }

  /**
   * Set output callback
   */
  setOutputCallback(callback: (output: string) => void): void {
    this.outputCallback = callback;
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): ConsoleCommand[] {
    if (limit) {
      return this.commandHistory.slice(-limit);
    }
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  // ========== Default Command Handlers ==========

  private async helpCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<string> {
    if (args.length === 0) {
      const lines = [
        "Available commands:",
        "",
        "  help, h, ?          - Show this help message",
        "  state, s            - Show current state",
        "  get, g <path>       - Get state value at path",
        "  set <path> <value>  - Set state value at path",
        "  trace, t            - Show active trace info",
        "  inspect, i <id>     - Inspect a trace or event",
        "  continue, c         - Continue execution",
        "  step                - Step into next node",
        "  next, n             - Step over next node",
        "  break, b <node>     - Set breakpoint on node",
        "  watch, w <path>     - Watch a variable",
        "  clear               - Clear screen/history",
        "  history             - Show command history",
        "  vars, v             - Show console variables",
        "  eval, e <expr>      - Evaluate expression",
        "  backtrace, bt       - Show execution backtrace",
        "  quit, q, exit       - Exit debug console",
        "",
        'Use "help <command>" for more information on a specific command.',
      ];
      return lines.join("\n");
    }

    const commandName = args[0];
    const helpTexts: Record<string, string> = {
      state: "Show the current execution state.\nUsage: state",
      get: "Get a value from the current state using dot notation.\nUsage: get <path>\nExample: get user.name",
      set: 'Set a value in the current state.\nUsage: set <path> <value>\nExample: set user.name "John"',
      trace: "Show information about the active trace.\nUsage: trace",
      inspect:
        "Inspect a trace or event in detail.\nUsage: inspect <trace_id|event_id>",
      continue: "Continue execution until next breakpoint.\nUsage: continue",
      step: "Step into the next node (enter function calls).\nUsage: step",
      next: "Step over the next node (skip function calls).\nUsage: next",
      break:
        "Set a breakpoint on a node.\nUsage: break <node_name> [condition]\nExample: break agent1 when state.value > 10",
      watch:
        "Watch a variable for changes.\nUsage: watch <path>\nExample: watch state.counter",
      clear: "Clear the screen or history.\nUsage: clear [screen|history]",
      history: "Show command history.\nUsage: history [limit]",
      vars: "Show all console variables.\nUsage: vars",
      eval: "Evaluate a JavaScript expression.\nUsage: eval <expression>\nExample: eval state.messages.length",
      backtrace: "Show execution backtrace.\nUsage: backtrace",
      quit: "Exit the debug console.\nUsage: quit",
    };

    return (
      helpTexts[commandName] ?? `No help available for command: ${commandName}`
    );
  }

  private async stateCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    if (args.length === 0) {
      return context.current_state;
    }

    const path = args[0];
    return this.getNestedValue(context.current_state, path);
  }

  private async getCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    if (args.length === 0) {
      throw new Error("Usage: get <path>");
    }

    const path = args[0];
    const value = this.getNestedValue(context.current_state, path);

    if (value === undefined) {
      return `undefined (path: ${path})`;
    }

    return value;
  }

  private async setCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<string> {
    if (args.length < 2) {
      throw new Error("Usage: set <path> <value>");
    }

    const path = args[0];
    const value = this.parseValue(args.slice(1).join(" "));

    this.setNestedValue(context.current_state, path, value);

    return `Set ${path} = ${JSON.stringify(value)}`;
  }

  private async traceCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    if (!context.active_trace) {
      return "No active trace";
    }

    const trace = context.active_trace;
    return {
      trace_id: trace.trace_id,
      graph_id: trace.graph_id,
      duration_ms: trace.duration_ms,
      events: trace.events.length,
      status: trace.status,
      metrics: trace.metrics,
    };
  }

  private async inspectCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    if (args.length === 0) {
      throw new Error("Usage: inspect <trace_id|event_id>");
    }

    const id = args[0];

    if (context.active_trace && id === context.active_trace.trace_id) {
      return context.active_trace;
    }

    // Search for event in trace
    if (context.active_trace) {
      const event = context.active_trace.events.find(e => e.event_id === id);
      if (event) {
        return event;
      }
    }

    return `Not found: ${id}`;
  }

  private async continueCommand(): Promise<string> {
    return "Continuing execution...";
  }

  private async stepCommand(): Promise<string> {
    return "Stepping into next node...";
  }

  private async nextCommand(): Promise<string> {
    return "Stepping over next node...";
  }

  private async breakCommand(args: string[]): Promise<string> {
    if (args.length === 0) {
      return "Usage: break <node_name> [condition]";
    }

    const nodeName = args[0];
    const condition = args.length > 1 ? args.slice(1).join(" ") : undefined;

    return `Breakpoint set on node: ${nodeName}${condition ? ` (when: ${condition})` : ""}`;
  }

  private async watchCommand(args: string[]): Promise<string> {
    if (args.length === 0) {
      return "Usage: watch <path>";
    }

    const path = args[0];
    return `Watching: ${path}`;
  }

  private async clearCommand(args: string[]): Promise<string> {
    if (args.length === 0 || args[0] === "screen") {
      if (this.outputCallback) {
        this.outputCallback("\x1b[2J\x1b[H"); // ANSI clear screen
      }
      return "";
    }

    if (args[0] === "history") {
      this.clearHistory();
      return "Command history cleared";
    }

    return `Usage: clear [screen|history]`;
  }

  private async historyCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    const limit = args.length > 0 ? parseInt(args[0], 10) : 20;
    const history = this.getHistory(limit);

    return history.map(cmd => ({
      command: cmd.command,
      timestamp: new Date(cmd.timestamp).toISOString(),
      duration_ms: cmd.duration_ms,
      error: cmd.error?.message,
    }));
  }

  private async varsCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    return context.variables;
  }

  private async evalCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    if (args.length === 0) {
      throw new Error("Usage: eval <expression>");
    }

    const expression = args.join(" ");

    try {
      const func = new Function(
        "state",
        "trace",
        "vars",
        `return ${expression}`
      );

      return func(
        context.current_state,
        context.active_trace,
        context.variables
      );
    } catch (error) {
      throw new Error(`Evaluation error: ${(error as Error).message}`);
    }
  }

  private async backtraceCommand(
    args: string[],
    context: DebugConsoleContext
  ): Promise<unknown> {
    if (!context.active_trace) {
      return "No active trace";
    }

    const trace = context.active_trace;
    const stack: Array<{ event: string; time: number; node?: string }> = [];

    for (const event of trace.events) {
      if (
        event.event_type === "node_start" ||
        event.event_type === "node_end"
      ) {
        stack.push({
          event: event.event_type,
          time: event.timestamp,
          node: event.node_name,
        });
      }
    }

    return stack;
  }

  private async quitCommand(): Promise<string> {
    return "Exiting debug console...";
  }

  // ========== Helper Methods ==========

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let value: unknown = obj;

    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  private parseValue(str: string): unknown {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  /**
   * Export console state
   */
  exportState(): {
    context: DebugConsoleContext;
    history: ConsoleCommand[];
  } {
    return {
      context: this.context,
      history: this.commandHistory,
    };
  }

  /**
   * Import console state
   */
  importState(state: {
    context?: Partial<DebugConsoleContext>;
    history?: ConsoleCommand[];
  }): void {
    if (state.context) {
      this.updateContext(state.context);
    }
    if (state.history) {
      this.commandHistory = state.history;
    }
  }

  /**
   * Get console statistics
   */
  getStatistics(): {
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    avgCommandTime: number;
  } {
    const total = this.commandHistory.length;
    const successful = this.commandHistory.filter(c => !c.error).length;
    const failed = total - successful;
    const totalTime = this.commandHistory.reduce(
      (sum, c) => sum + c.duration_ms,
      0
    );
    const avgTime = total > 0 ? totalTime / total : 0;

    return {
      totalCommands: total,
      successfulCommands: successful,
      failedCommands: failed,
      avgCommandTime: avgTime,
    };
  }
}
