/**
 * @lsi/vljepa-synthetic - React Renderer
 *
 * Renders components to React code.
 *
 * @module renderers
 */

import type { GeneratedComponent, CSSProperties } from "../types.js";
import { camelToKebab } from "../utils.js";

export interface ReactComponentOptions {
  typescript?: boolean;
  styledComponents?: boolean;
  inlineStyles?: boolean;
}

export class ReactRenderer {
  /**
   * Render component to React code
   */
  renderComponent(
    component: GeneratedComponent,
    options: ReactComponentOptions = {}
  ): string {
    if (options.typescript) {
      return this.renderTypeScriptComponent(component, options);
    }
    return this.renderJavaScriptComponent(component, options);
  }

  /**
   * Render TypeScript React component
   */
  private renderTypeScriptComponent(
    component: GeneratedComponent,
    options: ReactComponentOptions
  ): string {
    const interfaceName = `${this.toPascalCase(component.type)}Props`;
    const componentName = this.toPascalCase(component.type);

    let code = `import React from 'react';\n\n`;

    if (options.inlineStyles) {
      code += `interface ${interfaceName} {\n  className?: string;\n}\n\n`;
      code += `const ${componentName}: React.FC<${interfaceName}> = ({ className = '' }) => {\n`;
      code += `  const styles: React.CSSProperties = ${JSON.stringify(component.styles, null, 2)};\n\n`;
      code += `  return (\n    ${this.convertHTMLToJSX(component.code, 4)}\n  );\n};\n\n`;
      code += `export default ${componentName};`;
    }

    return code;
  }

  /**
   * Render JavaScript React component
   */
  private renderJavaScriptComponent(
    component: GeneratedComponent,
    options: ReactComponentOptions
  ): string {
    const componentName = this.toPascalCase(component.type);

    let code = `import React from 'react';\n\n`;

    if (options.inlineStyles) {
      code += `const ${componentName} = ({ className = '' }) => {\n`;
      code += `  const styles = ${JSON.stringify(component.styles, null, 2)};\n\n`;
      code += `  return (\n    ${this.convertHTMLToJSX(component.code, 4)}\n  );\n};\n\n`;
      code += `export default ${componentName};`;
    }

    return code;
  }

  /**
   * Convert HTML to JSX
   */
  private convertHTMLToJSX(html: string, indent: number): string {
    const jsx = html
      .replace(/class=/g, "className=")
      .replace(/for=/g, "htmlFor=")
      .replace(/style="([^"]*)"/g, (_, styles) => {
        // Convert CSS string to JSX style object
        const styleObj = this.parseInlineStyles(styles);
        return `style={${JSON.stringify(styleObj)}}`;
      })
      .replace(/<!--.*?-->/g, "")
      .replace(/&nbsp;/g, "{' '}");

    return this.indentCode(jsx, indent);
  }

  /**
   * Parse inline CSS string to object
   */
  private parseInlineStyles(cssString: string): Record<string, string> {
    const styles: Record<string, string> = {};
    const declarations = cssString.split(";").filter(Boolean);

    for (const decl of declarations) {
      const [property, value] = decl.split(":").map(s => s.trim());
      if (property && value) {
        const jsProperty = camelToKebab(property).replace(/-([a-z])/g, (_, c) =>
          c.toUpperCase()
        );
        styles[jsProperty] = value;
      }
    }

    return styles;
  }

  /**
   * Indent code
   */
  private indentCode(code: string, spaces: number): string {
    const indent = " ".repeat(spaces);
    return code
      .split("\n")
      .map(line => (line.trim() ? indent + line : line))
      .join("\n");
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\s/g, "");
  }
}
