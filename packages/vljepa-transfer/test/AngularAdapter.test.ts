/**
 * Angular Adapter Tests
 * Test Angular-specific adapter functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AngularAdapter } from "../src/adapters/AngularAdapter.js";
import type { ComponentSpec, StyleSpec, AngularAdapterConfig } from "../src/types.js";

describe("AngularAdapter", () => {
  describe("Default Configuration", () => {
    let adapter: AngularAdapter;

    beforeEach(() => {
      adapter = new AngularAdapter();
    });

    it("should use default configuration", () => {
      expect(adapter.config.version).toBe("17");
      expect(adapter.config.standalone).toBe(true);
      expect(adapter.config.signals).toBe(true);
      expect(adapter.config.typescript).toBe(true);
    });

    it("should parse Angular component correctly", async () => {
      const angularCode = `
        @Component({
          selector: 'app-test',
          standalone: true,
          template: '<div>{{ message }}</div>',
          styles: ['.test { color: red; }']
        })
        export class TestComponent {
          message = 'Hello';
        }
      `;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.framework).toBe("angular");
      expect(ui.metadata.language).toBe("typescript");
      expect(ui.metadata.features).toContain("standalone");
    });

    it("should parse Angular inputs", async () => {
      const angularCode = `
        @Component({ selector: 'app-button', standalone: true })
        export class ButtonComponent {
          @Input() label: string;
          @Input() disabled = false;
        }
      `;

      const component = await adapter.parseComponent(angularCode);
      expect(component.props.length).toBeGreaterThan(0);
      expect(component.props[0].name).toBeDefined();
    });

    it("should parse Angular outputs", async () => {
      const angularCode = `
        @Component({ selector: 'app-button', standalone: true })
        export class ButtonComponent {
          @Output() click = new EventEmitter<MouseEvent>();
          @Output() change = new EventEmitter<string>();
        }
      `;

      const component = await adapter.parseComponent(angularCode);
      expect(component.events.length).toBeGreaterThan(0);
    });

    it("should parse Angular signals", async () => {
      const angularCode = `
        @Component({ selector: 'app-counter', standalone: true })
        export class CounterComponent {
          count = signal(0);
          doubled = computed(() => this.count() * 2);
        }
      `;

      const component = await adapter.parseComponent(angularCode);
      expect(component.state.length).toBeGreaterThan(0);
    });

    it("should convert React to Angular", async () => {
      const reactCode = `
        interface ButtonProps {
          label: string;
          onClick?: () => void;
        }

        export function Button({ label, onClick }: ButtonProps) {
          return <button onClick={onClick}>{label}</button>;
        }
      `;

      const angularCode = await adapter.convertFromReact(reactCode, "Button");
      expect(angularCode.component).toBeDefined();
      expect(angularCode.template).toBeDefined();
      expect(angularCode.component).toContain("@Component");
    });

    it("should convert JSX to Angular template", async () => {
      const jsx = `<div className="container" onClick={handleClick}><Button label="Click" /></div>`;

      const template = adapter["convertJSXToAngularTemplate"](jsx);
      expect(template).toContain("(click)");
    });

    it("should convert React hooks to Angular service", async () => {
      const reactCode = `
        const [count, setCount] = useState(0);
        useEffect(() => {
          console.log(count);
        }, [count]);
      `;

      const service = adapter["convertReactHooksToService"](reactCode);
      expect(service).toBeDefined();
    });

    it("should generate Angular component", async () => {
      const spec: ComponentSpec = {
        type: "Button",
        name: "TestButton",
        props: { label: "Click me", disabled: false },
        framework: "react",
      };

      const result = await adapter.generateComponent(spec);
      expect(result.success).toBe(true);
      expect(result.code.component).toContain("@Component");
      expect(result.code.component).toContain("export class");
    });

    it("should generate Angular style", async () => {
      const spec: StyleSpec = {
        selector: "my-button",
        properties: {
          backgroundColor: "blue",
          color: "white",
          borderRadius: "4px",
        },
        framework: "angular",
      };

      const style = await adapter.generateStyle(spec);
      expect(style.css).toContain("background-color: blue");
      expect(style.css).toContain("color: white");
    });
  });

  describe("Angular 15/16", () => {
    it("should support Angular 15", () => {
      const adapter = new AngularAdapter({ version: "15" });
      expect(adapter.config.version).toBe("15");
    });

    it("should support Angular 16", () => {
      const adapter = new AngularAdapter({ version: "16" });
      expect(adapter.config.version).toBe("16");
    });

    it("should support non-standalone components", () => {
      const adapter = new AngularAdapter({ standalone: false });
      expect(adapter.config.standalone).toBe(false);
    });

    it("should disable signals", () => {
      const adapter = new AngularAdapter({ signals: false });
      expect(adapter.config.signals).toBe(false);
    });
  });

  describe("Angular 18", () => {
    let adapter: AngularAdapter;

    beforeEach(() => {
      adapter = new AngularAdapter({ version: "18" });
    });

    it("should use Angular 18 configuration", () => {
      expect(adapter.config.version).toBe("18");
    });

    it("should support new features", () => {
      expect(adapter.config.signals).toBe(true);
      expect(adapter.config.standalone).toBe(true);
    });
  });

  describe("Template Conversion", () => {
    let adapter: AngularAdapter;

    beforeEach(() => {
      adapter = new AngularAdapter();
    });

    it("should convert className to class", () => {
      const result = adapter["convertJSXToAngularTemplate"]('<div className="test" />');
      expect(result).toContain('class="test"');
    });

    it("should convert onClick to (click)", () => {
      const result = adapter["convertJSXToAngularTemplate"]('<button onClick={handler} />');
      expect(result).toContain("(click)");
    });

    it("should convert onChange to (change)", () => {
      const result = adapter["convertJSXToAngularTemplate"]('<input onChange={handler} />');
      expect(result).toContain("(change)");
    });

    it("should convert {variable} to {{ variable }}", () => {
      const result = adapter["convertJSXToAngularTemplate"]("<div>{name}</div>");
      expect(result).toContain("{{name}}");
    });

    it("should convert self-closing tags", () => {
      const result = adapter["convertJSXToAngularTemplate"]("<Button />");
      expect(result).toContain("<Button></Button>");
    });

    it("should convert Array.map to *ngFor", () => {
      const jsx = "{items.map(item => <Item />)}";
      const result = adapter["convertJSXToAngularTemplate"](jsx);
      expect(result).toContain("*ngFor");
    });

    it("should convert conditional && to *ngIf", () => {
      const jsx = "{isVisible && <Component />}";
      const result = adapter["convertJSXToAngularTemplate"](jsx);
      expect(result).toContain("*ngIf");
    });
  });

  describe("Signals Support", () => {
    let adapter: AngularAdapter;

    beforeEach(() => {
      adapter = new AngularAdapter({ signals: true });
    });

    it("should convert useState to signal", () => {
      const reactCode = "const [count, setCount] = useState(0);";
      const state = adapter["convertReactStateToAngularSignals"](reactCode);
      expect(state.length).toBeGreaterThan(0);
      expect(state[0].isSignal).toBe(true);
    });

    it("should parse signal inputs", async () => {
      const angularCode = `
        @Component({ selector: 'app-button', standalone: true })
        export class ButtonComponent {
          readonly label = input<string>('');
          readonly disabled = input(false);
        }
      `;

      const component = await adapter.parseComponent(angularCode);
      expect(component.props.some((p: any) => p.isSignal)).toBe(true);
    });

    it("should parse signal outputs", async () => {
      const angularCode = `
        @Component({ selector: 'app-button', standalone: true })
        export class ButtonComponent {
          readonly click = output<MouseEvent>();
        }
      `;

      const component = await adapter.parseComponent(angularCode);
      expect(component.events.some((e: any) => e.isSignal)).toBe(true);
    });
  });

  describe("Traditional Angular", () => {
    let adapter: AngularAdapter;

    beforeEach(() => {
      adapter = new AngularAdapter({ signals: false, standalone: false });
    });

    it("should use @Input decorator", async () => {
      const angularCode = `
        @Component({ selector: 'app-button', standalone: false })
        export class ButtonComponent {
          @Input() label: string;
        }
      `;

      const component = await adapter.parseComponent(angularCode);
      expect(component.props.length).toBeGreaterThan(0);
    });

    it("should use @Output decorator", async () => {
      const angularCode = `
        @Component({ selector: 'app-button', standalone: false })
        export class ButtonComponent {
          @Output() click = new EventEmitter<MouseEvent>();
        }
      `;

      const component = await adapter.parseComponent(angularCode);
      expect(component.events.length).toBeGreaterThan(0);
    });

    it("should generate NgModule", async () => {
      const module = adapter["generateNgModule"]();
      expect(module).toContain("@NgModule");
      expect(module).toContain("BrowserModule");
    });
  });

  describe("Feature Detection", () => {
    let adapter: AngularAdapter;

    beforeEach(() => {
      adapter = new AngularAdapter();
    });

    it("should detect standalone components", async () => {
      const angularCode = `
        @Component({
          selector: 'app-test',
          standalone: true
        })
        export class TestComponent {}
      `;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.metadata.features).toContain("standalone");
    });

    it("should detect signals", async () => {
      const angularCode = `
        @Component({ selector: 'app-counter' })
        export class CounterComponent {
          count = signal(0);
          doubled = computed(() => this.count() * 2);
        }
      `;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.metadata.features).toContain("signals");
    });

    it("should detect RxJS", async () => {
      const angularCode = `
        import { Observable } from 'rxjs';

        @Component({ selector: 'app-test' })
        export class TestComponent {
          data$ = new Observable();
        }
      `;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.metadata.features).toContain("rxjs");
    });

    it("should detect reactive forms", async () => {
      const angularCode = `
        <form [formGroup]="myForm">
          <input formControlName="name" />
        </form>
      `;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.metadata.features).toContain("reactive-forms");
    });

    it("should detect async pipe", async () => {
      const angularCode = `<div *ngIf="data$ | async as data">{{ data }}</div>`;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.metadata.features).toContain("async-pipe");
    });

    it("should detect structural directives", async () => {
      const angularCode = `
        <div *ngFor="let item of items"></div>
        <div *ngIf="isVisible"></div>
      `;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.metadata.features).toContain("structural-directives");
    });

    it("should detect dependency injection", async () => {
      const angularCode = `
        constructor(@Inject(Service) private service: Service) {}
      `;

      const ui = await adapter.parseUI(angularCode);
      expect(ui.metadata.features).toContain("dependency-injection");
    });
  });

  describe("Component Mapping", () => {
    let adapter: AngularAdapter;

    beforeEach(() => {
      adapter = new AngularAdapter();
    });

    it("should map React Button to mat-button", () => {
      const target = adapter["mapComponentToFlutterWidget"]("Button");
      expect(target).toBeDefined();
    });

    it("should map React props to Angular inputs", () => {
      const mapping = adapter["convertReactPropsToAngularInputs"](
        `interface Props { className: string; onChange: (e: any) => void; }`
      );
      expect(mapping.length).toBeGreaterThan(0);
    });

    it("should map React events to Angular outputs", () => {
      const mapping = adapter["convertReactEventsToAngularOutputs"](
        `const handleClick = () => {}; return <button onClick={handleClick} />`
      );
      expect(mapping.length).toBeGreaterThan(0);
    });
  });
});
