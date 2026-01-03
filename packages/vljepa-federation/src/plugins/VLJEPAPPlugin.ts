/**
 * VLJEPAPPlugin - VL-JEPA specific plugin for module federation
 * Integrates VL-JEPA models with hot-swapping
 */

import type { Plugin } from "vite";

export interface VLJEPAPPluginOptions {
  enabled?: boolean;
  modelPath?: string;
  hotSwapModels?: boolean;
  cacheModels?: boolean;
}

export function vljepaFederationPlugin(
  options: VLJEPAPPluginOptions = {}
): Plugin {
  const {
    enabled = true,
    modelPath = "/models/vljepa",
    hotSwapModels = true,
    cacheModels = true,
  } = options;

  return {
    name: "vljepa-federation",

    config() {
      return {
        optimizeDeps: {
          include: ["@lsi/vljepa"],
        },
      };
    },

    configureServer(server) {
      if (!enabled) return;

      // API endpoint for model info
      server.middlewares.use("/api/vljepa/models", (req, res) => {
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              models: [
                {
                  name: "x-encoder",
                  version: "1.0.0",
                  path: `${modelPath}/x-encoder`,
                },
                {
                  name: "y-encoder",
                  version: "1.0.0",
                  path: `${modelPath}/y-encoder`,
                },
                {
                  name: "predictor",
                  version: "1.0.0",
                  path: `${modelPath}/predictor`,
                },
              ],
              hotSwapEnabled: hotSwapModels,
              cached: cacheModels,
            })
          );
        }
      });

      // WebSocket for model updates
      server.ws.on("vljepa:model-update", (data: any) => {
        if (hotSwapModels) {
          console.log("VL-JEPA model update:", data);
          server.ws.send({
            type: "custom",
            event: "vljepa:model-updated",
            data,
          });
        }
      });
    },

    transform(code, id) {
      // Inject VL-JEPA runtime
      if (id.includes("@lsi/vljepa")) {
        return {
          code: code.replace(/__VL_JEPA_VERSION__/g, JSON.stringify("1.0.0")),
          map: null,
        };
      }
    },

    buildEnd() {
      if (enabled) {
        console.log("VL-JEPA Federation plugin initialized");
      }
    },
  };
}
