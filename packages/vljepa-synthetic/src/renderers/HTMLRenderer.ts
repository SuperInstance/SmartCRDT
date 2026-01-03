/**
 * @lsi/vljepa-synthetic - HTML Renderer
 *
 * Renders components to HTML strings.
 *
 * @module renderers
 */

import type { GeneratedComponent, GeneratedLayout } from "../types.js";

export class HTMLRenderer {
  /**
   * Render component to HTML
   */
  renderComponent(component: GeneratedComponent): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${component.type}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 20px; }
  </style>
</head>
<body>
  ${component.code}
</body>
</html>`;
  }

  /**
   * Render layout to HTML
   */
  renderLayout(layout: GeneratedLayout): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${layout.pattern}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 20px; }
  </style>
</head>
<body>
  ${layout.code}
</body>
</html>`;
  }

  /**
   * Render page to HTML
   */
  renderPage(page: { code: string }): string {
    return page.code;
  }
}
