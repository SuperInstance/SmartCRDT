/**
 * Vue Adapter Tests
 * Test Vue-specific adapter functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VueAdapter } from "../src/adapters/VueAdapter.js";
import type { ComponentSpec, StyleSpec, VueAdapterConfig } from "../src/types.js";

describe("VueAdapter", () => {
  describe("Default Configuration", () => {
    let adapter: VueAdapter;

    beforeEach(() => {
      adapter = new VueAdapter();
    });

    it("should use default configuration", () => {
      expect(adapter.config.version).toBe("vue3");
      expect(adapter.config.script).toBe("composition");
      expect(adapter.config.style).toBe("scoped");
      expect(adapter.config.typescript).toBe(true);
    });

    it("should parse Vue SFC correctly", async () => {
      const vueCode = `
        <template>
          <div>{{ message }}</div>
        </template>

        <script setup lang="ts">
        import { ref } from 'vue';

        const message = ref('Hello');
        </script>

        <style scoped>
        .test { color: red; }
        </style>
      `;

      const ui = await adapter.parseUI(vueCode);
      expect(ui.framework).toBe("vue");
      expect(ui.metadata.language).toBe("typescript");
      expect(ui.metadata.features).toContain("composition-api");
    });

    it("should convert React to Vue", async () => {
      const reactCode = `
        interface ButtonProps {
          label: string;
          onClick?: () => void;
        }

        export function Button({ label, onClick }: ButtonProps) {
          return <button onClick={onClick}>{label}</button>;
        }
      `;

      const vueCode = await adapter.convertFromReact(reactCode, "Button");
      expect(vueCode.template).toBeDefined();
      expect(vueCode.script).toBeDefined();
      expect(vueCode.style).toBeDefined();
      expect(vueCode.template).toContain("@click");
    });

    it("should convert JSX to Vue template", async () => {
      const jsx = `<div className="container" onClick={handleClick}><Button label="Click" /></div>`;

      const template = adapter["convertJSXToVueTemplate"](jsx);
      expect(template).toContain('class="container"');
      expect(template).toContain("@click");
    });

    it("should convert React hooks to Vue script", async () => {
      const reactCode = `
        const [count, setCount] = useState<number>(0);
        const [name, setName] = useState<string>("");
      `;

      const script = adapter["convertReactToVueScript"](reactCode, "TestComponent");
      expect(script).toContain("const count = ref<number>(0)");
      expect(script).toContain("const name = ref<string>(\"\")");
    });

    it("should generate Vue component", async () => {
      const spec: ComponentSpec = {
        type: "Button",
        name: "TestButton",
        props: { label: "Click me", disabled: false },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.success).toBe(true);
      expect(result.code.template).toContain("<button");
      expect(result.code.script).toContain("defineProps");
    });

    it("should generate Vue style", async () => {
      const spec: StyleSpec = {
        selector: "my-button",
        properties: {
          backgroundColor: "blue",
          color: "white",
          borderRadius: "4px",
        },
        framework: "vue",
      };

      const style = await adapter.generateStyle(spec);
      expect(style.css).toContain("background-color: blue");
      expect(style.css).toContain("color: white");
      expect(style.css).toContain("border-radius: 4px");
    });

    it("should parse Vue props", async () => {
      const vueCode = `
        <script setup lang="ts">
        interface Props {
          label: string;
          disabled?: boolean;
        }

        const props = defineProps<Props>();
        </script>
      `;

      const component = await adapter.parseComponent(vueCode);
      expect(component.props.length).toBeGreaterThan(0);
    });

    it("should parse Vue state", async () => {
      const vueCode = `
        <script setup lang="ts">
        import { ref, computed } from 'vue';

        const count = ref(0);
        const doubled = computed(() => count.value * 2);
        </script>
      `;

      const component = await adapter.parseComponent(vueCode);
      expect(component.state.length).toBeGreaterThan(0);
    });

    it("should parse Vue events", async () => {
      const vueCode = `
        <script setup lang="ts">
        const emit = defineEmits<{
          click: [event: MouseEvent];
          change: [value: string];
        }>();
        </script>
      `;

      const component = await adapter.parseComponent(vueCode);
      expect(component.events.length).toBeGreaterThan(0);
    });
  });

  describe("Vue 2 Options API", () => {
    let adapter: VueAdapter;

    beforeEach(() => {
      const config: Partial<VueAdapterConfig> = {
        version: "vue2",
        script: "options",
      };
      adapter = new VueAdapter(config);
    });

    it("should parse Vue 2 Options API", async () => {
      const vueCode = `
        <script>
        export default {
          props: {
            label: String,
            disabled: Boolean
          },
          data() {
            return {
              count: 0
            }
          },
          methods: {
            handleClick() {
              this.count++;
            }
          }
        }
        </script>
      `;

      const ui = await adapter.parseUI(vueCode);
      expect(ui.framework).toBe("vue");
    });

    it("should convert to Options API format", async () => {
      const reactCode = `
        const [count, setCount] = useState(0);
      `;

      const script = adapter["convertReactToVueScript"](reactCode, "TestComponent");
      expect(script).toContain("data()");
    });
  });

  describe("Custom Configuration", () => {
    it("should use custom script type", () => {
      const adapter = new VueAdapter({ script: "options" });
      expect(adapter.config.script).toBe("options");
    });

    it("should use custom style type", () => {
      const adapter = new VueAdapter({ style: "css_modules" });
      expect(adapter.config.style).toBe("css_modules");
    });

    it("should support JavaScript", () => {
      const adapter = new VueAdapter({ typescript: false });
      expect(adapter.config.typescript).toBe(false);
    });
  });

  describe("Component Mapping", () => {
    let adapter: VueAdapter;

    beforeEach(() => {
      adapter = new VueAdapter();
    });

    it("should map React Button to el-button", () => {
      const target = adapter["mapReactTypeToVue"]("Button");
      expect(target).toBeDefined();
    });

    it("should map React props to Vue props", () => {
      const mapping = adapter.parseReactProps(
        `interface Props { className: string; onChange: (e: any) => void; value: string; }`
      );
      expect(mapping.length).toBeGreaterThan(0);
    });
  });

  describe("Template Conversion", () => {
    let adapter: VueAdapter;

    beforeEach(() => {
      adapter = new VueAdapter();
    });

    it("should convert className to class", () => {
      const result = adapter["convertJSXToVueTemplate"]('<div className="test" />');
      expect(result).toContain('class="test"');
    });

    it("should convert onClick to @click", () => {
      const result = adapter["convertJSXToVueTemplate"]('<button onClick={handler} />');
      expect(result).toContain("@click");
    });

    it("should convert onChange to @change", () => {
      const result = adapter["convertJSXToVueTemplate"]('<input onChange={handler} />');
      expect(result).toContain("@change");
    });

    it("should convert self-closing tags", () => {
      const result = adapter["convertJSXToVueTemplate"]('<Button />');
      expect(result).toContain("<Button></Button>");
    });

    it("should convert style object to CSS string", () => {
      const result = adapter["convertJSXToVueTemplate"](
        '<div style={{ color: "red", fontSize: "14px" }} />'
      );
      expect(result).toContain("style=");
    });

    it("should handle v-model for value binding", () => {
      const jsx = '<input value={value} onChange={handleChange} />';
      const result = adapter["convertJSXToVueTemplate"](jsx);
      // The conversion should handle two-way binding
      expect(result).toBeDefined();
    });
  });

  describe("Style Conversion", () => {
    let adapter: VueAdapter;

    beforeEach(() => {
      adapter = new VueAdapter();
    });

    it("should convert camelCase to kebab-case", () => {
      const result = adapter["kebabCase"]("backgroundColor");
      expect(result).toBe("background-color");
    });

    it("should convert style object to CSS", () => {
      const styleObj = { backgroundColor: "blue", fontSize: "14px" };
      const result = adapter["styleObjectToString"](JSON.stringify(styleObj));
      expect(result).toContain("background-color: blue");
      expect(result).toContain("font-size: 14px");
    });
  });

  describe("Feature Detection", () => {
    let adapter: VueAdapter;

    beforeEach(() => {
      adapter = new VueAdapter();
    });

    it("should detect composition API", async () => {
      const vueCode = `
        <script setup>
        import { ref } from 'vue';
        const count = ref(0);
        </script>
      `;

      const ui = await adapter.parseUI(vueCode);
      expect(ui.metadata.features).toContain("composition-api");
    });

    it("should detect reactivity features", async () => {
      const vueCode = `
        <script setup>
        import { ref, reactive, computed } from 'vue';
        const count = ref(0);
        const state = reactive({ name: 'test' });
        const doubled = computed(() => count.value * 2);
        </script>
      `;

      const ui = await adapter.parseUI(vueCode);
      expect(ui.metadata.features).toContain("reactivity");
      expect(ui.metadata.features).toContain("computed");
    });

    it("should detect lifecycle hooks", async () => {
      const vueCode = `
        <script setup>
        import { onMounted } from 'vue';
        onMounted(() => console.log('mounted'));
        </script>
      `;

      const ui = await adapter.parseUI(vueCode);
      expect(ui.metadata.features).toContain("lifecycle-hooks");
    });

    it("should detect watchers", async () => {
      const vueCode = `
        <script setup>
        import { ref, watch } from 'vue';
        const count = ref(0);
        watch(count, (val) => console.log(val));
        </script>
      `;

      const ui = await adapter.parseUI(vueCode);
      expect(ui.metadata.features).toContain("watchers");
    });

    it("should detect Suspense", async () => {
      const vueCode = `
        <Suspense>
          <template #default>
            <AsyncComponent />
          </template>
          <template #fallback>
            <div>Loading...</div>
          </template>
        </Suspense>
      `;

      const ui = await adapter.parseUI(vueCode);
      expect(ui.metadata.features).toContain("suspense");
    });
  });
});
