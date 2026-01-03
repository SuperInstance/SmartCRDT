// Type declarations for external packages without type definitions

declare module "commander" {
  export class Command {
    constructor(name?: string);
    version(version: string): this;
    description(desc: string): this;
    option(flags: string, description?: string, defaultValue?: any): this;
    action(callback: (...args: any[]) => void | Promise<void>): this;
    parse(argv?: string[]): void;
    addCommand(command: Command): this;
    alias(name: string): this;
    arguments(description: string): this;
  }
  export const program: Command;
  export function Option(flags: string, description?: string): any;
}

declare module "chalk" {
  const chalkInstance: {
    (text: string): string;
    reset: typeof chalkInstance;
    bold: typeof chalkInstance;
    dim: typeof chalkInstance;
    italic: typeof chalkInstance;
    underline: typeof chalkInstance;
    inverse: typeof chalkInstance;
    hidden: typeof chalkInstance;
    strikethrough: typeof chalkInstance;
    black: typeof chalkInstance;
    red: typeof chalkInstance;
    green: typeof chalkInstance;
    yellow: typeof chalkInstance;
    blue: typeof chalkInstance;
    magenta: typeof chalkInstance;
    cyan: typeof chalkInstance;
    white: typeof chalkInstance;
    gray: typeof chalkInstance;
    bgBlack: typeof chalkInstance;
    bgRed: typeof chalkInstance;
    bgGreen: typeof chalkInstance;
    bgYellow: typeof chalkInstance;
    bgBlue: typeof chalkInstance;
    bgMagenta: typeof chalkInstance;
    bgCyan: typeof chalkInstance;
    bgWhite: typeof chalkInstance;
  };
  export default chalkInstance;
  export const reset: any;
  export const bold: any;
  export const dim: any;
  export const italic: any;
  export const underline: any;
  export const inverse: any;
  export const hidden: any;
  export const strikethrough: any;
  export const black: any;
  export const red: any;
  export const green: any;
  export const yellow: any;
  export const blue: any;
  export const magenta: any;
  export const cyan: any;
  export const white: any;
  export const gray: any;
}

declare module "cli-table3" {
  export interface TableOptions {
    head?: string[];
    colWidths?: number[];
    colAligns?: Array<'left' | 'middle' | 'right'>;
    style?: {
      head?: string[];
      border?: string[];
    };
  }

  export class Table {
    constructor(options?: TableOptions);
    push(row: any[]): void;
    toString(): string;
  }
  export default Table;
}

declare module "yaml" {
  export function parse(str: string): any;
  export function stringify(obj: any, options?: any): string;
}

declare module "inquirer" {
  export interface Question {
    type: string;
    name: string;
    message: string;
    choices?: any[];
    default?: any;
    validate?: (input: any) => boolean | string | Promise<boolean | string>;
    filter?: (input: any) => any;
  }

  export interface PromptModule {
    prompt<T = any>(questions: Question[]): Promise<T>;
  }

  export function createPromptModule(): PromptModule;
  export const prompt: PromptModule;
}

// Missing internal packages - make them very permissive
declare module "@lsi/app-manager" {
  export class AppManager {
    constructor(config?: any);
    initialize(config?: any): Promise<any>;
    install(appId: string, options?: any): Promise<any>;
    uninstall(appId: string): Promise<any>;
    list(): Promise<any[]>;
    pull(appId: string): Promise<any>;
    run(appId: string): Promise<any>;
    components_path?: any;
  }
}

declare module "@lsi/registry" {
  export class ComponentRegistry {
    constructor(config?: any);
    get(id: string): Promise<any>;
    list(): Promise<any[]>;
    search(query: string): Promise<any[]>;
    initialize(): Promise<any>;
  }

  export class AppRegistry {
    constructor(config?: any);
    get(id: string): Promise<any>;
    list(): Promise<any[]>;
  }

  export class Registry {
    constructor(config?: any);
    get(id: string): Promise<any>;
    list(): Promise<any[]>;
  }
}

declare module "@lsi/config" {
  export class ConfigManager {
    constructor(path?: string);
    get(key: string): any;
    set(key: string, value: any): void;
    load(): Promise<void>;
    save(): Promise<void>;
  }

  export function get(key: string): any;
  export function set(key: string, value: any): void;
}

declare module "@lsi/manager" {
  export class Manager {
    start(): Promise<void>;
    stop(): Promise<void>;
  }
}

declare module "vitest" {
  export const describe: any;
  export const it: any;
  export const test: any;
  export const expect: any;
  export const beforeEach: any;
  export const afterEach: any;
  export const beforeAll: any;
  export const afterAll: any;
}

declare module "@lsi/native/bindings" {
  export const native: any;
}
