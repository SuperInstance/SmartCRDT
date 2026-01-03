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

declare module "ajv" {
  const ajv: any;
  export = ajv;
}

declare module "ajv-formats" {
  const plugin: any;
  export default plugin;
}
