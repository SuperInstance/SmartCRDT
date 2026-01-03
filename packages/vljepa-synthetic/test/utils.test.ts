/**
 * @lsi/vljepa-synthetic - Utility Tests
 *
 * 30+ tests for utility functions
 */

import { describe, it, expect } from "vitest";
import { createSeededRandom, createColorUtils, generateId, camelToKebab, kebabToCamel, escapeHtml, chunk, flatten, unique, groupBy } from "../src/utils.js";

describe("createSeededRandom", () => {
  it("should generate consistent values with same seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);

    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("should generate different values with different seeds", () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);

    expect(rng1()).not.toBe(rng2());
  });

  it("should generate values between 0 and 1", () => {
    const rng = createSeededRandom(42);

    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it("should generate int in range", () => {
    const rng = createSeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const val = rng.int(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(20);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("should generate float in range", () => {
    const rng = createSeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const val = rng.float(5.5, 10.5);
      expect(val).toBeGreaterThanOrEqual(5.5);
      expect(val).toBeLessThanOrEqual(10.5);
    }
  });

  it("should pick from array", () => {
    const rng = createSeededRandom(42);
    const arr = ["a", "b", "c", "d", "e"];

    for (let i = 0; i < 50; i++) {
      const val = rng.pick(arr);
      expect(arr).toContain(val);
    }
  });

  it("should pick N items from array", () => {
    const rng = createSeededRandom(42);
    const arr = ["a", "b", "c", "d", "e"];

    const picked = rng.pickN(arr, 3);

    expect(picked).toHaveLength(3);
    picked.forEach(item => {
      expect(arr).toContain(item);
    });
  });

  it("should handle pickN larger than array", () => {
    const rng = createSeededRandom(42);
    const arr = ["a", "b", "c"];

    const picked = rng.pickN(arr, 10);

    expect(picked).toHaveLength(3);
  });

  it("should shuffle array", () => {
    const rng = createSeededRandom(42);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const shuffled = rng.shuffle(arr);

    expect(shuffled).toHaveLength(arr.length);
    arr.forEach(item => {
      expect(shuffled).toContain(item);
    });
  });

  it("should return seed", () => {
    const seed = 42;
    const rng = createSeededRandom(seed);

    expect(rng.getSeed()).toBe(seed);
  });
});

describe("createColorUtils", () => {
  it("should generate random hex color", () => {
    const colors = createColorUtils(42);

    for (let i = 0; i < 100; i++) {
      const color = colors.random();
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("should generate color in hue range", () => {
    const colors = createColorUtils(42);

    const color = colors.randomHue(180, 240);

    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("should generate complementary color", () => {
    const colors = createColorUtils(42);
    const color = "#3b82f6";

    const comp = colors.complementary(color);

    expect(comp).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(comp).not.toBe(color);
  });

  it("should generate analogous colors", () => {
    const colors = createColorUtils(42);
    const color = "#3b82f6";

    const analogous = colors.analogous(color, 2);

    expect(analogous).toHaveLength(5); // Original + 2 on each side
    analogous.forEach(c => {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("should generate triadic colors", () => {
    const colors = createColorUtils(42);
    const color = "#3b82f6";

    const triadic = colors.triadic(color);

    expect(triadic).toHaveLength(3);
    triadic.forEach(c => {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("should generate monochromatic palette", () => {
    const colors = createColorUtils(42);
    const color = "#3b82f6";

    const mono = colors.monochromatic(color, 5);

    expect(mono).toHaveLength(5);
    mono.forEach(c => {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("should calculate color distance", () => {
    const colors = createColorUtils(42);

    const distance = colors.distance("#ffffff", "#000000");

    expect(distance).toBeGreaterThan(0);
  });

  it("should calculate luminance", () => {
    const colors = createColorUtils(42);

    const lumWhite = colors.luminance("#ffffff");
    const lumBlack = colors.luminance("#000000");

    expect(lumWhite).toBeCloseTo(1, 1);
    expect(lumBlack).toBeCloseTo(0, 1);
    expect(lumWhite).toBeGreaterThan(lumBlack);
  });

  it("should detect dark colors", () => {
    const colors = createColorUtils(42);

    expect(colors.isDark("#000000")).toBe(true);
    expect(colors.isDark("#ffffff")).toBe(false);
  });

  it("should calculate contrast ratio", () => {
    const colors = createColorUtils(42);

    const ratio = colors.contrastRatio("#ffffff", "#000000");

    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeCloseTo(21, 0);
  });
});

describe("generateId", () => {
  it("should generate unique IDs", () => {
    const ids = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      const id = generateId();
      ids.add(id);
    }

    expect(ids.size).toBe(1000);
  });

  it("should include prefix", () => {
    const id = generateId("test");

    expect(id).toContain("test");
  });

  it("should generate IDs without prefix", () => {
    const id = generateId();

    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("should generate different IDs with same prefix", () => {
    const id1 = generateId("btn");
    const id2 = generateId("btn");

    expect(id1).not.toBe(id2);
  });
});

describe("camelToKebab", () => {
  it("should convert simple camelCase", () => {
    expect(camelToKebab("fontSize")).toBe("font-size");
  });

  it("should convert multiple words", () => {
    expect(camelToKebab("backgroundColor")).toBe("background-color");
  });

  it("should handle single word", () => {
    expect(camelToKebab("color")).toBe("color");
  });

  it("should handle consecutive caps", () => {
    expect(camelToKebab("XMLHttpRequest")).toBe("xml-http-request");
  });
});

describe("kebabToCamel", () => {
  it("should convert simple kebab-case", () => {
    expect(kebabToCamel("font-size")).toBe("fontSize");
  });

  it("should convert multiple words", () => {
    expect(kebabToCamel("background-color")).toBe("backgroundColor");
  });

  it("should handle single word", () => {
    expect(kebabToCamel("color")).toBe("color");
  });
});

describe("escapeHtml", () => {
  it("should escape ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("should escape less than", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("should escape greater than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("should escape quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("should escape single quotes", () => {
    expect(escapeHtml("'hello'")).toBe("&#39;hello&#39;");
  });

  it("should escape multiple special chars", () => {
    expect(escapeHtml("<div>&nbsp;</div>")).toBe("&lt;div&gt;&amp;nbsp;&lt;/div&gt;");
  });
});

describe("chunk", () => {
  it("should chunk array", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const chunks = chunk(arr, 3);

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toEqual([1, 2, 3]);
    expect(chunks[3]).toEqual([10]);
  });

  it("should handle empty array", () => {
    const chunks = chunk([], 3);

    expect(chunks).toHaveLength(0);
  });

  it("should handle size larger than array", () => {
    const arr = [1, 2, 3];
    const chunks = chunk(arr, 10);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(arr);
  });
});

describe("flatten", () => {
  it("should flatten nested arrays", () => {
    const arr = [[1, 2], [3, 4], [5, 6]];
    const flat = flatten(arr);

    expect(flat).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("should handle empty arrays", () => {
    expect(flatten([])).toEqual([]);
    expect(flatten([[], []])).toEqual([]);
  });
});

describe("unique", () => {
  it("should remove duplicates", () => {
    const arr = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4];
    const uniq = unique(arr);

    expect(uniq).toEqual([1, 2, 3, 4]);
  });

  it("should handle empty array", () => {
    expect(unique([])).toEqual([]);
  });

  it("should handle array with no duplicates", () => {
    const arr = [1, 2, 3, 4];
    const uniq = unique(arr);

    expect(uniq).toEqual(arr);
  });
});

describe("groupBy", () => {
  it("should group by key", () => {
    const arr = [
      { type: "button", label: "Click" },
      { type: "input", label: "Text" },
      { type: "button", label: "Submit" },
    ];

    const grouped = groupBy(arr, item => item.type);

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped.button).toHaveLength(2);
    expect(grouped.input).toHaveLength(1);
  });

  it("should handle empty array", () => {
    const grouped = groupBy([], item => item.type);

    expect(Object.keys(grouped)).toHaveLength(0);
  });

  it("should group all items", () => {
    const arr = [
      { type: "a", value: 1 },
      { type: "a", value: 2 },
      { type: "b", value: 3 },
      { type: "b", value: 4 },
    ];

    const grouped = groupBy(arr, item => item.type);

    expect(grouped.a).toHaveLength(2);
    expect(grouped.b).toHaveLength(2);
  });
});
