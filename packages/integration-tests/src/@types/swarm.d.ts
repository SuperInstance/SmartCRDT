declare module '@lsi/swarm' {
  export interface CRDTStore {
    get(key: string): any;
    set(key: string, value: any): void;
    delete(key: string): void;
  }

  export class CRDTStoreImpl implements CRDTStore {
    constructor(config: any);
    get(key: string): any;
    set(key: string, value: any): void;
    delete(key: string): void;
  }

  export interface CRDTypes {
    GCounter: any;
    PNCounter: any;
    LWWRegister: any;
    MVRegister: any;
  }
}