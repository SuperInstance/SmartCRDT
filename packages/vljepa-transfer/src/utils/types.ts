/**
 * Type utilities
 */

export function inferType(value: any): string {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "any";
}

export function mapType(
  type: string,
  sourceLanguage: string,
  targetLanguage: string
): string {
  // Type mapping between languages
  const mappings: Record<string, Record<string, string>> = {
    typescript: {
      python: {
        string: "str",
        number: "float",
        boolean: "bool",
        any: "Any",
      },
      dart: {
        string: "String",
        number: "double",
        boolean: "bool",
        any: "dynamic",
      },
      swift: {
        string: "String",
        number: "Double",
        boolean: "Bool",
        any: "Any",
      },
    },
  };

  return mappings[sourceLanguage]?.[targetLanguage]?.[type] || type;
}

export function validateType(value: any, expectedType: string): boolean {
  return inferType(value) === expectedType;
}
