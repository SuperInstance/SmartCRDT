declare module '@lsi/superinstance' {
  export class ContextPlane {
    constructor(config: any);
  }

  export class IntentionPlane {
    constructor(config: any);
  }

  export class LucidDreamer {
    constructor(config: any);
  }

  export interface SuperInstanceConfig {
    context?: any;
    intention?: any;
    lucidDreamer?: any;
  }

  export class SuperInstance {
    constructor(config: SuperInstanceConfig);
  }
}