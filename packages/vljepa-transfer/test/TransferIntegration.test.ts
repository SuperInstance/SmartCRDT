/**
 * Transfer Learning Integration Tests
 * Test end-to-end transfer learning workflows
 */

import { describe, it, expect } from "vitest";
import { VueAdapter } from "../src/adapters/VueAdapter.js";
import { AngularAdapter } from "../src/adapters/AngularAdapter.js";
import { FlutterAdapter } from "../src/adapters/FlutterAdapter.js";
import { SvelteAdapter } from "../src/adapters/SvelteAdapter.js";
import { SwiftUIAdapter } from "../src/adapters/SwiftUIAdapter.js";
import { TransferTrainer } from "../src/training/TransferTrainer.js";
import {
  ComponentMapper,
  ComponentMappingRegistry,
} from "../src/mapping/ComponentMapping.js";
import type { ComponentSpec, StyleSpec, UIFramework } from "../src/types.js";

describe("Transfer Learning Integration", () => {
  describe("React to Vue Workflow", () => {
    it("should convert React component to Vue", async () => {
      const adapter = new VueAdapter();
      const reactCode = `
        interface ButtonProps {
          label: string;
          disabled?: boolean;
          onClick?: () => void;
        }

        export function Button({ label, disabled, onClick }: ButtonProps) {
          return (
            <button
              className="btn"
              disabled={disabled}
              onClick={onClick}
            >
              {label}
            </button>
          );
        }
      `;

      const vueCode = await adapter.convertFromReact(reactCode, "Button");

      expect(vueCode.template).toBeDefined();
      expect(vueCode.script).toBeDefined();
      expect(vueCode.style).toBeDefined();
      expect(vueCode.template).toContain("<button");
      expect(vueCode.template).toContain("@click");
      expect(vueCode.template).not.toContain("onClick");
    });

    it("should map React props to Vue props", async () => {
      const adapter = new VueAdapter();
      const reactCode = `
        interface Props {
          value: string;
          onChange: (val: string) => void;
        }
      `;

      const props = adapter["parseReactProps"](reactCode);

      expect(props.length).toBeGreaterThan(0);
    });

    it("should convert React state to Vue ref", async () => {
      const adapter = new VueAdapter();
      const reactCode = `
        const [count, setCount] = useState<number>(0);
        const [name, setName] = useState<string>("");
      `;

      const script = adapter["convertReactToVueScript"](reactCode, "Component");

      expect(script).toContain("ref<number>");
      expect(script).toContain("ref<string>");
    });
  });

  describe("React to Angular Workflow", () => {
    it("should convert React component to Angular", async () => {
      const adapter = new AngularAdapter();
      const reactCode = `
        interface ButtonProps {
          label: string;
          onClick?: () => void;
        }

        export function Button({ label, onClick }: ButtonProps) {
          return <button (click)="onClick">{label}</button>;
        }
      `;

      const angularCode = await adapter.convertFromReact(reactCode, "Button");

      expect(angularCode.component).toBeDefined();
      expect(angularCode.template).toBeDefined();
      expect(angularCode.component).toContain("@Component");
      expect(angularCode.template).toContain("(click)");
    });

    it("should convert React hooks to Angular signals", async () => {
      const adapter = new AngularAdapter({ signals: true });
      const reactCode = `
        const [count, setCount] = useState(0);
      `;

      const state = adapter["convertReactStateToAngularSignals"](reactCode);

      expect(state.length).toBeGreaterThan(0);
      expect(state[0].isSignal).toBe(true);
    });

    it("should generate standalone component", async () => {
      const adapter = new AngularAdapter({ standalone: true });
      const spec: ComponentSpec = {
        type: "Button",
        name: "TestButton",
        props: { label: "Click" },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);

      expect(result.code.component).toContain("standalone: true");
    });
  });

  describe("React to Flutter Workflow", () => {
    it("should convert React component to Flutter", async () => {
      const adapter = new FlutterAdapter();
      const reactCode = `
        export function Button({ label, onClick }) {
          return <button onClick={onClick}>{label}</button>;
        }
      `;

      const flutterCode = await adapter.convertFromReact(reactCode, "Button");

      expect(flutterCode.widget).toBeDefined();
      expect(flutterCode.state).toBeDefined();
      expect(flutterCode.widget).toContain("StatelessWidget");
    });

    it("should map React types to Dart types", () => {
      const adapter = new FlutterAdapter();

      expect(adapter["mapReactTypeToDart"]("string")).toBe("String");
      expect(adapter["mapReactTypeToDart"]("boolean")).toBe("Bool");
      expect(adapter["mapReactTypeToDart"]("number")).toBeDefined();
    });

    it("should generate StatefulWidget with state", async () => {
      const adapter = new FlutterAdapter();
      const spec: ComponentSpec = {
        type: "Input",
        name: "TextInput",
        props: { value: "" },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);

      expect(result.code.widget).toContain("StatefulWidget");
    });
  });

  describe("React to Svelte Workflow", () => {
    it("should convert React component to Svelte", async () => {
      const adapter = new SvelteAdapter();
      const reactCode = `
        export function Button({ label, onClick }) {
          return <button onClick={onClick}>{label}</button>;
        }
      `;

      const svelteCode = await adapter.convertFromReact(reactCode, "Button");

      expect(svelteCode.script).toBeDefined();
      expect(svelteCode.template).toBeDefined();
      expect(svelteCode.script).toContain("export let");
      expect(svelteCode.template).toContain("on:click");
    });

    it("should convert React state to Svelte runes (v5)", async () => {
      const adapter = new SvelteAdapter({ version: "5" });
      const reactCode = `
        const [count, setCount] = useState(0);
      `;

      const state = adapter["parseReactState"](reactCode);

      expect(state.length).toBeGreaterThan(0);
    });

    it("should convert React state to reactive statements (v4)", async () => {
      const adapter = new SvelteAdapter({ version: "4" });
      const reactCode = `
        const [count, setCount] = useState(0);
      `;

      const script = adapter["convertReactToSvelteScript"](reactCode);

      expect(script).toContain("let");
    });
  });

  describe("React to SwiftUI Workflow", () => {
    it("should convert React component to SwiftUI", async () => {
      const adapter = new SwiftUIAdapter();
      const reactCode = `
        export function Button({ label, onClick }) {
          return <button onClick={onClick}>{label}</button>;
        }
      `;

      const swiftuiCode = await adapter.convertFromReact(reactCode, "Button");

      expect(swiftuiCode.view).toBeDefined();
      expect(swiftuiCode.view).toContain("struct");
      expect(swiftuiCode.view).toContain("View");
    });

    it("should map React types to Swift types", () => {
      const adapter = new SwiftUIAdapter();

      expect(adapter["mapReactTypeToSwift"]("string")).toBe("String");
      expect(adapter["mapReactTypeToSwift"]("boolean")).toBe("Bool");
      expect(adapter["mapReactTypeToSwift"]("number")).toBeDefined();
    });

    it("should generate SwiftUI modifiers", async () => {
      const adapter = new SwiftUIAdapter();
      const spec: StyleSpec = {
        selector: "button",
        properties: {
          padding: "16px",
          cornerRadius: "8px",
          background: "blue",
        },
        framework: "swiftui",
      };

      const style = await adapter.generateStyle(spec);

      expect(style.modifiers).toContain(".padding");
      expect(style.modifiers).toContain(".cornerRadius");
    });
  });

  describe("Component Mapping Integration", () => {
    it("should map component through all frameworks", () => {
      const component = {
        name: "MyButton",
        type: "Button",
        props: [
          { name: "label", type: "string", required: true },
          { name: "disabled", type: "boolean", required: false },
        ],
        state: [],
        events: [],
        children: [],
      };

      const vue = ComponentMapper.mapComponent(component, "vue");
      const angular = ComponentMapper.mapComponent(component, "angular");
      const flutter = ComponentMapper.mapComponent(component, "flutter");

      expect(vue.type).toBe("el-button");
      expect(angular.type).toBe("mat-button");
      expect(flutter.type).toBe("ElevatedButton");
    });

    it("should get target component names", () => {
      const vueButton = ComponentMapper.getTargetComponent("Button", "react", "vue");
      const angularButton = ComponentMapper.getTargetComponent("Button", "react", "angular");
      const flutterButton = ComponentMapper.getTargetComponent("Button", "react", "flutter");

      expect(vueButton).toBe("el-button");
      expect(angularButton).toBe("mat-button");
      expect(flutterButton).toBe("ElevatedButton");
    });
  });

  describe("Transfer Training Integration", () => {
    it("should train adapter on framework dataset", async () => {
      const trainer = new TransferTrainer({
        epochs: 2,
        batchSize: 2,
        earlyStopping: false,
      });

      const dataset = {
        framework: "vue" as UIFramework,
        components: [
          {
            id: "1",
            type: "Button",
            code: "<button>Click</button>",
            parsed: {
              name: "Button",
              type: "button",
              props: [],
              state: [],
              events: [],
              children: [],
            },
            metadata: {},
          },
          {
            id: "2",
            type: "Input",
            code: "<input />",
            parsed: {
              name: "Input",
              type: "input",
              props: [],
              state: [],
              events: [],
              children: [],
            },
            metadata: {},
          },
        ],
        styles: [],
        patterns: [],
        size: 2,
      };

      const result = await trainer.train(dataset);

      expect(result.model).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.framework).toBe("vue");
    });

    it("should fine-tune on specific components", async () => {
      const trainer = new TransferTrainer({
        epochs: 1,
        earlyStopping: false,
      });

      const mockModel = {
        encoder: [{ name: "layer1", type: "dense", frozen: false, params: 100 }],
        decoder: [{ name: "layer2", type: "dense", frozen: false, params: 100 }],
        latentDim: 128,
        inputShape: [224, 224, 3] as [number, number, number],
        version: "1.0.0",
      };

      const components = [
        {
          id: "1",
          type: "Button",
          code: "<button>Click</button>",
          parsed: {
            name: "Button",
            type: "button",
            props: [],
            state: [],
            events: [],
            children: [],
          },
          metadata: {},
        },
      ];

      const result = await trainer.fineTune(mockModel, components);

      expect(result).toBeDefined();
    });
  });

  describe("Cross-Framework Compatibility", () => {
    it("should check React to Vue compatibility", async () => {
      const adapter = new VueAdapter();
      const reactCode = `
        export function Component() {
          return <div>Hello</div>;
        }
      `;

      const vueCode = await adapter.convertFromReact(reactCode, "Component");

      expect(vueCode.template).toBeDefined();
      expect(vueCode.template.length).toBeGreaterThan(0);
    });

    it("should check React to Angular compatibility", async () => {
      const adapter = new AngularAdapter();
      const reactCode = `
        export function Component() {
          return <div>Hello</div>;
        }
      `;

      const angularCode = await adapter.convertFromReact(reactCode, "Component");

      expect(angularCode.component).toBeDefined();
      expect(angularCode.template).toBeDefined();
    });

    it("should handle complex nested components", async () => {
      const adapter = new VueAdapter();
      const reactCode = `
        export function Card({ title, children }) {
          return (
            <div className="card">
              <h2>{title}</h2>
              <div className="content">{children}</div>
            </div>
          );
        }
      `;

      const vueCode = await adapter.convertFromReact(reactCode, "Card");

      expect(vueCode.template).toBeDefined();
    });
  });

  describe("End-to-End Conversion Workflow", () => {
    it("should convert full React component to Vue", async () => {
      const adapter = new VueAdapter();
      const reactComponent = `
        interface CounterProps {
          initial?: number;
        }

        export function Counter({ initial = 0 }: CounterProps) {
          const [count, setCount] = useState(initial);
          const [isEven, setIsEven] = useState(true);

          useEffect(() => {
            setIsEven(count % 2 === 0);
          }, [count]);

          return (
            <div className="counter">
              <p>Count: {count}</p>
              <button onClick={() => setCount(c => c + 1)}>Increment</button>
              <p>{isEven ? 'Even' : 'Odd'}</p>
            </div>
          );
        }
      `;

      const vueCode = await adapter.convertFromReact(reactCode, "Counter");

      expect(vueCode.template).toBeDefined();
      expect(vueCode.script).toBeDefined();
      expect(vueCode.script).toContain("ref");
    });

    it("should convert full React component to Angular", async () => {
      const adapter = new AngularAdapter({ signals: true });
      const reactComponent = `
        export function Form() {
          const [name, setName] = useState('');
          const [email, setEmail] = useState('');

          const handleSubmit = () => {
            console.log(name, email);
          };

          return (
            <form onSubmit={handleSubmit}>
              <input value={name} onChange={e => setName(e.target.value)} />
              <input value={email} onChange={e => setEmail(e.target.value)} />
              <button type="submit">Submit</button>
            </form>
          );
        }
      `;

      const angularCode = await adapter.convertFromReact(reactComponent, "Form");

      expect(angularCode.component).toBeDefined();
      expect(angularCode.template).toBeDefined();
      expect(angularCode.component).toContain("signal");
    });

    it("should convert full React component to Flutter", async () => {
      const adapter = new FlutterAdapter();
      const reactComponent = `
        export function Button({ label, onPress }) {
          return (
            <button
              style={{
                padding: '16px',
                background: 'blue',
                color: 'white',
                borderRadius: '8px'
              }}
              onClick={onPress}
            >
              {label}
            </button>
          );
        }
      `;

      const flutterCode = await adapter.convertFromReact(reactComponent, "Button");

      expect(flutterCode.widget).toBeDefined();
      expect(flutterCode.widget).toContain("ElevatedButton");
    });
  });

  describe("Style Conversion Integration", () => {
    it("should convert CSS styles to Vue scoped styles", async () => {
      const adapter = new VueAdapter();
      const reactStyles = `
        .button {
          background-color: blue;
          color: white;
          padding: 16px;
          border-radius: 8px;
        }
      `;

      const vueStyles = adapter["parseStyleBlock"](reactStyles);

      expect(vueStyles.length).toBeGreaterThan(0);
      expect(vueStyles[0].selector).toBe("button");
    });

    it("should convert inline styles to Flutter BoxDecoration", async () => {
      const adapter = new FlutterAdapter();
      const inlineStyle = {
        backgroundColor: "#FF0000",
        borderRadius: "8px",
        padding: "16px",
      };

      const decoration = await adapter.generateStyle({
        selector: "container",
        properties: inlineStyle,
        framework: "flutter",
      });

      expect(decoration.decoration).toContain("BoxDecoration");
    });

    it("should convert inline styles to SwiftUI modifiers", async () => {
      const adapter = new SwiftUIAdapter();
      const inlineStyle = {
        padding: "16px",
        cornerRadius: "8px",
        background: "blue",
      };

      const modifiers = await adapter.generateStyle({
        selector: "button",
        properties: inlineStyle,
        framework: "swiftui",
      });

      expect(modifiers.modifiers).toContain(".padding");
    });
  });

  describe("Framework Registry Integration", () => {
    it("should work with all registered adapters", () => {
      const adapters = [
        new VueAdapter(),
        new AngularAdapter(),
        new FlutterAdapter(),
        new SvelteAdapter(),
        new SwiftUIAdapter(),
      ];

      adapters.forEach((adapter) => {
        expect(adapter.name).toBeDefined();
        expect(adapter.framework).toBeDefined();
      });
    });

    it("should support all target frameworks", () => {
      const frameworks: UIFramework[] = ["vue", "angular", "flutter", "svelte", "swiftui"];

      frameworks.forEach((framework) => {
        const mapping = ComponentMappingRegistry.get("react", framework);
        expect(mapping).toBeDefined();
      });
    });
  });
});
