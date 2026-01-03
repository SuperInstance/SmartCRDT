/**
 * A2UIPlugin - A2UI protocol plugin for module federation
 * Enables hot-swapping of A2UI components
 */

import type { Plugin } from "vite";

export interface A2UIPluginOptions {
  enabled?: boolean;
  componentPath?: string;
  hotSwapComponents?: boolean;
}

export function a2uiFederationPlugin(options: A2UIPluginOptions = {}): Plugin {
  const {
    enabled = true,
    componentPath = "/components/a2ui",
    hotSwapComponents = true,
  } = options;

  return {
    name: "a2ui-federation",

    config() {
      return {
        optimizeDeps: {
          include: ["@lsi/a2ui"],
        },
      };
    },

    configureServer(server) {
      if (!enabled) return;

      // API endpoint for component info
      server.middlewares.use("/api/a2ui/components", (req, res) => {
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              components: [
                {
                  name: "A2UIRenderer",
                  version: "1.0.0",
                  path: `${componentPath}/renderer`,
                },
                {
                  name: "A2UIComponent",
                  version: "1.0.0",
                  path: `${componentPath}/component`,
                },
              ],
              hotSwapEnabled: hotSwapComponents,
            })
          );
        }
      });

      // WebSocket for component updates
      server.ws.on("a2ui:component-update", (data: any) => {
        if (hotSwapComponents) {
          console.log("A2UI component update:", data);
          server.ws.send({
            type: "custom",
            event: "a2ui:component-updated",
            data,
          });
        }
      });
    },

    transform(code, id) {
      // Inject A2UI runtime
      if (id.includes("@lsi/a2ui")) {
        return {
          code: code.replace(/__A2UI_VERSION__/g, JSON.stringify("0.8.0")),
          map: null,
        };
      }
    },

    buildEnd() {
      if (enabled) {
        console.log("A2UI Federation plugin initialized");
      }
    },
  };
}
