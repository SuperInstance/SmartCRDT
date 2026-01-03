/**
 * Component Mapping - Map components between UI frameworks
 * Provides bidirectional mapping rules for component conversion
 */

import type {
  UIFramework,
  ComponentMapping as ComponentMappingType,
  PropMapping,
  EventMapping,
  StyleMapping,
  ParsedComponent,
} from "../types.js";

// ============================================================================
// Component Mapping Registry
// ============================================================================

export class ComponentMappingRegistry {
  private static mappings: Map<string, ComponentMappingType> = new Map();

  static register(mapping: ComponentMappingType): void {
    const key = `${mapping.fromFramework}-${mapping.toFramework}`;
    this.mappings.set(key, mapping);
  }

  static get(
    fromFramework: UIFramework,
    toFramework: UIFramework
  ): ComponentMappingType | undefined {
    const key = `${fromFramework}-${toFramework}`;
    return this.mappings.get(key);
  }

  static has(fromFramework: UIFramework, toFramework: UIFramework): boolean {
    const key = `${fromFramework}-${toFramework}`;
    return this.mappings.has(key);
  }
}

// ============================================================================
// React to Vue Component Mapping
// ============================================================================

export const ReactToVueMapping: ComponentMappingType = {
  fromFramework: "react",
  toFramework: "vue",
  mappings: new Map([
    // Basic components
    ["Button", "el-button"],
    ["Input", "el-input"],
    ["TextField", "el-input"],
    ["Select", "el-select"],
    ["Checkbox", "el-checkbox"],
    ["Radio", "el-radio"],
    ["Switch", "el-switch"],
    ["Slider", "el-slider"],
    ["Card", "el-card"],
    ["Dialog", "el-dialog"],
    ["Modal", "el-dialog"],
    ["Alert", "el-alert"],
    ["Badge", "el-badge"],
    ["Table", "el-table"],
    ["List", "el-list"],
    ["Typography", "el-text"],
    ["Image", "el-image"],
    ["Icon", "el-icon"],
    ["Avatar", "el-avatar"],
    ["Chip", "el-tag"],
    ["Divider", "el-divider"],
    ["Progress", "el-progress"],
    ["Tooltip", "el-tooltip"],
    ["Popover", "el-popover"],
    ["Menu", "el-menu"],
    ["AppBar", "el-header"],
    ["Drawer", "el-drawer"],
    ["Snackbar", "el-message"],
  ]),
  props: [
    { fromProp: "className", toProp: "class" },
    { fromProp: "onChange", toProp: "@change" },
    { fromProp: "onClick", toProp: "@click" },
    { fromProp: "onSubmit", toProp: "@submit" },
    { fromProp: "onFocus", toProp: "@focus" },
    { fromProp: "onBlur", toProp: "@blur" },
    { fromProp: "disabled", toProp: "disabled" },
    { fromProp: "placeholder", toProp: "placeholder" },
    { fromProp: "value", toProp: "v-model" },
    { fromProp: "defaultValue", toProp: "v-model" },
    { fromProp: "children", toProp: "default" },
    { fromProp: "style", toProp: ":style" },
  ],
  events: [
    { fromEvent: "onClick", toEvent: "click" },
    { fromEvent: "onChange", toEvent: "change" },
    { fromEvent: "onInput", toEvent: "input" },
    { fromEvent: "onSubmit", toEvent: "submit" },
    { fromEvent: "onFocus", toEvent: "focus" },
    { fromEvent: "onBlur", toEvent: "blur" },
    { fromEvent: "onLoad", toEvent: "load" },
    { fromEvent: "onError", toEvent: "error" },
  ],
  styles: [
    { fromStyle: "className", toStyle: "class" },
    { fromStyle: "style", toStyle: ":style" },
    { fromStyle: "css", toStyle: "scoped css" },
  ],
};

// ============================================================================
// React to Angular Component Mapping
// ============================================================================

export const ReactToAngularMapping: ComponentMappingType = {
  fromFramework: "react",
  toFramework: "angular",
  mappings: new Map([
    ["Button", "mat-button"],
    ["Input", "mat-input"],
    ["TextField", "mat-form-field"],
    ["Select", "mat-select"],
    ["Checkbox", "mat-checkbox"],
    ["Radio", "mat-radio"],
    ["Switch", "mat-slide-toggle"],
    ["Slider", "mat-slider"],
    ["Card", "mat-card"],
    ["Dialog", "mat-dialog"],
    ["Modal", "mat-dialog"],
    ["Alert", "mat-snack-bar"],
    ["Badge", "mat-badge"],
    ["Table", "mat-table"],
    ["List", "mat-list"],
    ["Typography", "mat Typography"],
    ["Image", "img"],
    ["Icon", "mat-icon"],
    ["Avatar", "mat-avatar"],
    ["Chip", "mat-chip"],
    ["Divider", "mat-divider"],
    ["Progress", "mat-progress-bar"],
    ["Tooltip", "mat-tooltip"],
    ["Popover", "mat-popover"],
    ["Menu", "mat-menu"],
    ["AppBar", "mat-toolbar"],
    ["Drawer", "mat-sidenav"],
    ["Snackbar", "mat-snack-bar"],
  ]),
  props: [
    { fromProp: "className", toProp: "class" },
    { fromProp: "onChange", toProp: "(change)" },
    { fromProp: "onClick", toProp: "(click)" },
    { fromProp: "onSubmit", toProp: "(ngSubmit)" },
    { fromProp: "onFocus", toProp: "(focus)" },
    { fromProp: "onBlur", toProp: "(blur)" },
    { fromProp: "disabled", toProp: "disabled" },
    { fromProp: "placeholder", toProp: "placeholder" },
    { fromProp: "value", toProp: "[ngModel]" },
    { fromProp: "children", toProp: "ng-content" },
    { fromProp: "style", toProp: "[ngStyle]" },
    { fromProp: "hidden", toProp: "*ngIf" },
  ],
  events: [
    { fromEvent: "onClick", toEvent: "click" },
    { fromEvent: "onChange", toEvent: "change" },
    { fromEvent: "onInput", toEvent: "input" },
    { fromEvent: "onSubmit", toEvent: "ngSubmit" },
    { fromEvent: "onFocus", toEvent: "focus" },
    { fromEvent: "onBlur", toEvent: "blur" },
    { fromEvent: "onLoad", toEvent: "load" },
    { fromEvent: "onError", toEvent: "error" },
  ],
  styles: [
    { fromStyle: "className", toStyle: "class" },
    { fromStyle: "style", toStyle: "[ngStyle]" },
    { fromStyle: "css", toStyle: "styles" },
  ],
};

// ============================================================================
// React to Flutter Component Mapping
// ============================================================================

export const ReactToFlutterMapping: ComponentMappingType = {
  fromFramework: "react",
  toFramework: "flutter",
  mappings: new Map([
    ["Button", "ElevatedButton"],
    ["TextButton", "TextButton"],
    ["IconButton", "IconButton"],
    ["Input", "TextField"],
    ["TextField", "TextField"],
    ["Select", "DropdownButton"],
    ["Checkbox", "Checkbox"],
    ["Radio", "Radio"],
    ["Switch", "Switch"],
    ["Slider", "Slider"],
    ["Card", "Card"],
    ["Dialog", "Dialog"],
    ["Modal", "showDialog"],
    ["Alert", "AlertDialog"],
    ["Badge", "Badge"],
    ["Table", "DataTable"],
    ["List", "ListView"],
    ["Grid", "GridView"],
    ["Container", "Container"],
    ["Row", "Row"],
    ["Column", "Column"],
    ["Stack", "Stack"],
    ["Text", "Text"],
    ["Image", "Image"],
    ["Icon", "Icon"],
    ["Avatar", "CircleAvatar"],
    ["Chip", "Chip"],
    ["Divider", "Divider"],
    ["Progress", "LinearProgressIndicator"],
    ["Spinner", "CircularProgressIndicator"],
    ["Tooltip", "Tooltip"],
    ["Menu", "PopupMenu"],
    ["AppBar", "AppBar"],
    ["Drawer", "Drawer"],
    ["Snackbar", "SnackBar"],
  ]),
  props: [
    { fromProp: "className", toProp: "decoration" },
    { fromProp: "onChange", toProp: "onChanged" },
    { fromProp: "onClick", toProp: "onPressed" },
    { fromProp: "disabled", toProp: "enabled" },
    { fromProp: "placeholder", toProp: "hintText" },
    { fromProp: "value", toProp: "controller" },
    { fromProp: "children", toProp: "child" },
    { fromProp: "style", toProp: "style" },
    { fromProp: "hidden", toProp: "Visibility" },
  ],
  events: [
    { fromEvent: "onClick", toEvent: "onPressed" },
    { fromEvent: "onChange", toEvent: "onChanged" },
    { fromEvent: "onInput", toEvent: "onChanged" },
    { fromEvent: "onFocus", toEvent: "onFocus" },
    { fromEvent: "onBlur", toEvent: "onBlur" },
  ],
  styles: [
    { fromStyle: "className", toStyle: "decoration" },
    { fromStyle: "style", toStyle: "BoxDecoration" },
    { fromStyle: "css", toStyle: "no direct equivalent" },
  ],
};

// ============================================================================
// React to Svelte Component Mapping
// ============================================================================

export const ReactToSvelteMapping: ComponentMappingType = {
  fromFramework: "react",
  toFramework: "svelte",
  mappings: new Map([
    ["Button", "Button"],
    ["Input", "Input"],
    ["TextField", "Input"],
    ["Select", "Select"],
    ["Checkbox", "Checkbox"],
    ["Radio", "Radio"],
    ["Switch", "Switch"],
    ["Slider", "Slider"],
    ["Card", "Card"],
    ["Dialog", "Dialog"],
    ["Modal", "Modal"],
    ["Alert", "Alert"],
    ["Badge", "Badge"],
    ["Table", "Table"],
    ["List", "List"],
    ["Typography", "Text"],
    ["Image", "Image"],
    ["Icon", "Icon"],
    ["Avatar", "Avatar"],
    ["Chip", "Chip"],
    ["Divider", "Divider"],
    ["Progress", "Progress"],
    ["Tooltip", "Tooltip"],
    ["Popover", "Popover"],
    ["Menu", "Menu"],
    ["AppBar", "AppBar"],
    ["Drawer", "Drawer"],
    ["Snackbar", "Snackbar"],
  ]),
  props: [
    { fromProp: "className", toProp: "class" },
    { fromProp: "onChange", toProp: "on:change" },
    { fromProp: "onClick", toProp: "on:click" },
    { fromProp: "onSubmit", toProp: "on:submit" },
    { fromProp: "onFocus", toProp: "on:focus" },
    { fromProp: "onBlur", toProp: "on:blur" },
    { fromProp: "disabled", toProp: "disabled" },
    { fromProp: "placeholder", toProp: "placeholder" },
    { fromProp: "value", toProp: "value" },
    { fromProp: "children", toProp: "children" },
    { fromProp: "style", toProp: "style" },
    { fromProp: "hidden", toProp: "hidden" },
  ],
  events: [
    { fromEvent: "onClick", toEvent: "click" },
    { fromEvent: "onChange", toEvent: "change" },
    { fromEvent: "onInput", toEvent: "input" },
    { fromEvent: "onSubmit", toEvent: "submit" },
    { fromEvent: "onFocus", toEvent: "focus" },
    { fromEvent: "onBlur", toEvent: "blur" },
  ],
  styles: [
    { fromStyle: "className", toStyle: "class" },
    { fromStyle: "style", toStyle: "style" },
    { fromStyle: "css", toStyle: "style" },
  ],
};

// ============================================================================
// React to SwiftUI Component Mapping
// ============================================================================

export const ReactToSwiftUIMapping: ComponentMappingType = {
  fromFramework: "react",
  toFramework: "swiftui",
  mappings: new Map([
    ["Button", "Button"],
    ["TextButton", "Button"],
    ["IconButton", "Button"],
    ["Input", "TextField"],
    ["TextField", "TextField"],
    ["Select", "Picker"],
    ["Checkbox", "Toggle"],
    ["Radio", "Picker"],
    ["Switch", "Toggle"],
    ["Slider", "Slider"],
    ["Card", "VStack with background"],
    ["Dialog", "Alert"],
    ["Modal", "Sheet"],
    ["Alert", "Alert"],
    ["Badge", "Text with background"],
    ["Table", "List"],
    ["List", "List"],
    ["Grid", "LazyVGrid"],
    ["Container", "VStack/HStack"],
    ["Row", "HStack"],
    ["Column", "VStack"],
    ["Stack", "ZStack"],
    ["Text", "Text"],
    ["Image", "Image"],
    ["Icon", "Image"],
    ["Avatar", "Circle"],
    ["Chip", "Text with padding"],
    ["Divider", "Divider"],
    ["Progress", "ProgressView"],
    ["Spinner", "ProgressView"],
    ["Tooltip", "Tooltip"],
    ["Menu", "Menu"],
    ["AppBar", "Toolbar"],
    ["Drawer", "Sidebar"],
    ["Snackbar", "alert"],
  ]),
  props: [
    { fromProp: "className", toProp: ".background()" },
    { fromProp: "onChange", toProp: ".onChange()" },
    { fromProp: "onClick", toProp: ".onTapGesture()" },
    { fromProp: "disabled", toProp: ".disabled()" },
    { fromProp: "placeholder", toProp: "parameter" },
    { fromProp: "value", toProp: "@Binding" },
    { fromProp: "children", toProp: "ViewBuilder" },
    { fromProp: "style", toProp: "modifiers" },
    { fromProp: "hidden", toProp: ".hidden()" },
  ],
  events: [
    { fromEvent: "onClick", toEvent: "onTapGesture" },
    { fromEvent: "onChange", toEvent: "onChange" },
    { fromEvent: "onInput", toEvent: "onChange" },
    { fromEvent: "onFocus", toEvent: "onFocus" },
    { fromEvent: "onBlur", toEvent: "onBlur" },
  ],
  styles: [
    { fromStyle: "className", toStyle: "modifiers" },
    { fromStyle: "style", toStyle: "modifiers" },
    { fromStyle: "css", toStyle: "no direct equivalent" },
  ],
};

// ============================================================================
// Component Mapper
// ============================================================================

export class ComponentMapper {
  /**
   * Map a component from one framework to another
   */
  static mapComponent(
    component: ParsedComponent,
    targetFramework: UIFramework
  ): ParsedComponent {
    const sourceFramework = this.inferFramework(component);
    const mapping = ComponentMappingRegistry.get(
      sourceFramework,
      targetFramework
    );

    if (!mapping) {
      throw new Error(
        `No mapping found from ${sourceFramework} to ${targetFramework}`
      );
    }

    const mappedComponent = this.applyMapping(component, mapping);

    return mappedComponent;
  }

  /**
   * Get the target component name for a source component
   */
  static getTargetComponent(
    sourceComponent: string,
    sourceFramework: UIFramework,
    targetFramework: UIFramework
  ): string | undefined {
    const mapping = ComponentMappingRegistry.get(
      sourceFramework,
      targetFramework
    );
    return mapping?.mappings.get(sourceComponent);
  }

  /**
   * Map props from source to target
   */
  static mapProps(
    props: any[],
    sourceFramework: UIFramework,
    targetFramework: UIFramework
  ): any[] {
    const mapping = ComponentMappingRegistry.get(
      sourceFramework,
      targetFramework
    );

    if (!mapping) {
      return props;
    }

    return props.map(prop => {
      const propMapping = mapping.props.find(p => p.fromProp === prop.name);

      if (propMapping) {
        return {
          ...prop,
          name: propMapping.toProp,
          transform: propMapping.transform,
        };
      }

      return prop;
    });
  }

  /**
   * Map events from source to target
   */
  static mapEvents(
    events: any[],
    sourceFramework: UIFramework,
    targetFramework: UIFramework
  ): any[] {
    const mapping = ComponentMappingRegistry.get(
      sourceFramework,
      targetFramework
    );

    if (!mapping) {
      return events;
    }

    return events.map(event => {
      const eventMapping = mapping.events.find(e => e.fromEvent === event.name);

      if (eventMapping) {
        return {
          ...event,
          name: eventMapping.toEvent,
          transform: eventMapping.transform,
        };
      }

      return event;
    });
  }

  /**
   * Map styles from source to target
   */
  static mapStyles(
    styles: any[],
    sourceFramework: UIFramework,
    targetFramework: UIFramework
  ): any[] {
    const mapping = ComponentMappingRegistry.get(
      sourceFramework,
      targetFramework
    );

    if (!mapping) {
      return styles;
    }

    return styles.map(style => {
      const styleMapping = mapping.styles.find(
        s => s.fromStyle === style.selector
      );

      if (styleMapping) {
        return {
          ...style,
          selector: styleMapping.toStyle,
          transform: styleMapping.transform,
        };
      }

      return style;
    });
  }

  // ------------------------------------------------------------------------
  // Private Helper Methods
  // ------------------------------------------------------------------------

  private static inferFramework(component: ParsedComponent): UIFramework {
    // Infer framework from component patterns
    if (component.template?.includes("v-")) {
      return "vue";
    }
    if (component.template?.includes("*ng")) {
      return "angular";
    }
    if (
      component.template?.includes("ElevatedButton") ||
      component.template?.includes("Container")
    ) {
      return "flutter";
    }
    if (component.script?.includes("@State")) {
      return "svelte";
    }
    if (component.script?.includes("some View")) {
      return "swiftui";
    }

    // Default to React
    return "react";
  }

  private static applyMapping(
    component: ParsedComponent,
    mapping: ComponentMappingType
  ): ParsedComponent {
    const targetComponentName =
      mapping.mappings.get(component.type) || component.type;

    return {
      ...component,
      type: targetComponentName,
      props: this.mapProps(
        component.props,
        mapping.fromFramework,
        mapping.toFramework
      ),
      events: this.mapEvents(
        component.events,
        mapping.fromFramework,
        mapping.toFramework
      ),
    };
  }
}

// ============================================================================
// Register all mappings
// ============================================================================

ComponentMappingRegistry.register(ReactToVueMapping);
ComponentMappingRegistry.register(ReactToAngularMapping);
ComponentMappingRegistry.register(ReactToFlutterMapping);
ComponentMappingRegistry.register(ReactToSvelteMapping);
ComponentMappingRegistry.register(ReactToSwiftUIMapping);

// Reverse mappings
ComponentMappingRegistry.register({
  fromFramework: "vue",
  toFramework: "react",
  mappings: new Map(
    Array.from(ReactToVueMapping.mappings.entries()).map(([k, v]) => [v, k])
  ),
  props: ReactToVueMapping.props.map(p => ({
    fromProp: p.toProp,
    toProp: p.fromProp,
  })),
  events: ReactToVueMapping.events.map(e => ({
    fromEvent: e.toEvent,
    toEvent: e.fromEvent,
  })),
  styles: ReactToVueMapping.styles.map(s => ({
    fromStyle: s.toStyle,
    toStyle: s.fromStyle,
  })),
});

ComponentMappingRegistry.register({
  fromFramework: "angular",
  toFramework: "react",
  mappings: new Map(
    Array.from(ReactToAngularMapping.mappings.entries()).map(([k, v]) => [v, k])
  ),
  props: ReactToAngularMapping.props.map(p => ({
    fromProp: p.toProp,
    toProp: p.fromProp,
  })),
  events: ReactToAngularMapping.events.map(e => ({
    fromEvent: e.toEvent,
    toEvent: e.fromEvent,
  })),
  styles: ReactToAngularMapping.styles.map(s => ({
    fromStyle: s.toStyle,
    toStyle: s.fromStyle,
  })),
});
