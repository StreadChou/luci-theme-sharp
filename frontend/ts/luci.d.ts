interface LuCIMenuNode {
  name?: string;
  title?: string;
  order?: number;
  satisfied?: boolean;
  children?: Record<string, LuCIMenuNode>;
  action?: { type: string; path?: string };
}

interface LuCIUI {
  menu: {
    load(): Promise<LuCIMenuNode>;
    getChildren(node: LuCIMenuNode): Array<LuCIMenuNode & { name: string; title: string }>;
  };
  changes: {
    changes?: Record<string, unknown[]>;
    displayChanges(): void;
  };
}

declare const L: {
  loaded?: boolean;
  env: { dispatchpath: string[]; requestpath: string[]; sessionid?: string };
  url(...segments: string[]): string;
  require(name: 'ui'): Promise<LuCIUI>;
};
declare function _(message: string, context?: string): string;
declare function N_(count: number, singular: string, plural: string, context?: string): string;
