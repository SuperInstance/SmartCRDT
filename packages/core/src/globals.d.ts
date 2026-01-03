/**
 * Global type declarations for @lsi/core
 */

declare namespace NodeJS {
  interface Timeout {
    ref(): this;
    unref(): this;
  }
}

declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
};

declare function setInterval(callback: () => void, ms: number): NodeJS.Timeout;

declare function clearInterval(timeout: NodeJS.Timeout): void;

declare function setTimeout(callback: () => void, ms: number): NodeJS.Timeout;

declare function clearTimeout(timeout: NodeJS.Timeout): void;
