/**
 * Vite FederationPlugin - Module federation plugin for Vite
 * Enable hot-swapping of federated modules in Vite
 */

import type { Plugin, UserConfig } from "vite";
import type { FederationConfig, PluginConfig } from "../types.js";

export function federationPlugin(options: FederationPluginOptions): Plugin {
  let config: FederationConfig;
  let devMode: boolean = true;

  return {
    name: "vite-federation",

    config(userConfig: UserConfig) {
      devMode = userConfig.mode !== "production";

      config = {
        name: options.name,
        filename: options.filename || "remoteEntry.js",
        exposes: Object.entries(options.exposes || {}).map(([name, import]) => ({
          name,
          import,
        })),
        remotes: Object.entries(options.remotes || {}).map(([name, entry]) => {
          const [url, global] = entry.split("@");
          return {
            name,
            entry: url,
            entryGlobal: global || `${name}Remote`,
            scope: name,
          };
        }),
        shared: Object.entries(options.shared || {}).map(([key, dep]) => ({
          key,
          requiredVersion: dep.requiredVersion,
          strictVersion: dep.strictVersion,
          singleton: dep.singleton,
        })),
        version: options.version || "1.0.0",
      };

      return {
        build: {
          rollupOptions: {
            output: {
              // Ensure proper module format
              format: "es",
              // Preserve module structure
              manualChunks: undefined,
            },
          },
        },
        server: {
          headers: {
            // Enable shared array buffer for module federation
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
          },
        },
      };
    },

    configureServer(server) {
      // HMR for federated modules
      server.ws.on("federation:reload", async (data: any) => {
        const { module } = data;

        // Reload the module
        server.moduleGraph.invalidateModule(
          server.moduleGraph.getModuleById(module)
        );

        // Notify clients
        server.ws.send({
          type: "full-reload",
          path: "*",
        });
      });

      // Watch for changes to exposed modules
      server.watcher.on("change", (path) => {
        const exposed = config.exposes.find((e) => path.includes(e.import));
        if (exposed) {
          console.log(`Federated module changed: ${exposed.name}`);
          server.ws.send({
            type: "custom",
            event: "federation:change",
            data: { module: exposed.name },
          });
        }
      });
    },

    transform(code, id) {
      // Inject federation runtime
      if (id.includes("/node_modules/") && code.includes("__webpack_share_scopes__")) {
        return {
          code: code.replace(
            /__webpack_share_scopes__/g,
            "__vite_federation_scopes__"
          ),
          map: null,
        };
      }
    },

    generateBundle() {
      // Generate manifest
      this.emitFile({
        type: "asset",
        fileName: "federation-manifest.json",
        source: JSON.stringify({
          name: config.name,
          version: config.version,
          exposes: config.exposes,
          remotes: config.remotes,
          shared: config.shared,
        }, null, 2),
      });
    },

    async writeBundle() {
      if (devMode) {
        console.log("Federation plugin initialized");
        console.log(`Name: ${config.name}`);
        console.log(`Exposed modules: ${config.exposes.map((e) => e.name).join(", ")}`);
      }
    },
  };
}

/**
 * Federation plugin options
 */
export interface FederationPluginOptions {
  name: string;
  filename?: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, {
    requiredVersion: string;
    strictVersion?: boolean;
    singleton?: boolean;
  }>;
  version?: string;
}

/**
 * Plugin factory
 */
export class FederationPluginFactory {
  private plugins: Map<string, Plugin> = new Map();

  /**
   * Create host plugin
   */
  createHost(options: {
    name: string;
    remotes: Record<string, string>;
    shared?: Record<string, any>;
  }): Plugin {
    return federationPlugin({
      name: options.name,
      remotes: options.remotes,
      shared: options.shared,
    });
  }

  /**
   * Create remote plugin
   */
  createRemote(options: {
    name: string;
    filename?: string;
    exposes: Record<string, string>;
    shared?: Record<string, any>;
  }): Plugin {
    return federationPlugin({
      name: options.name,
      filename: options.filename,
      exposes: options.exposes,
      shared: options.shared,
    });
  }

  /**
   * Register plugin
   */
  register(name: string, plugin: Plugin): void {
    this.plugins.set(name, plugin);
  }

  /**
   * Get plugin
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all plugins
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
  }
}

/**
 * HMR handler for federated modules
 */
export class FederationHMR {
  private listeners: Map<string, Set<() => void>> = new Map();

  /**
   * Subscribe to module changes
   */
  subscribe(moduleId: string, callback: () => void): () => void {
    if (!this.listeners.has(moduleId)) {
      this.listeners.set(moduleId, new Set());
    }

    this.listeners.get(moduleId)!.add(callback);

    return () => {
      this.listeners.get(moduleId)?.delete(callback);
    };
  }

  /**
   * Notify listeners of module change
   */
  notify(moduleId: string): void {
    const callbacks = this.listeners.get(moduleId);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}
