/**
 * @lsi/langgraph-state - Validation Tests
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  StateValidator,
  TypeValidator,
  createBuiltInSchemas,
  createValidator,
  validateState,
  createSchema,
  validateNestedProperty
} from '../src/validation.js';

describe('TypeValidator', () => {
  describe('validateType', () => {
    it('should validate string type', () => {
      expect(TypeValidator.validateType('hello', 'string')).toBe(true);
      expect(TypeValidator.validateType(123, 'string')).toBe(false);
    });

    it('should validate number type', () => {
      expect(TypeValidator.validateType(123, 'number')).toBe(true);
      expect(TypeValidator.validateType(NaN, 'number')).toBe(false);
      expect(TypeValidator.validateType('123', 'number')).toBe(false);
    });

    it('should validate boolean type', () => {
      expect(TypeValidator.validateType(true, 'boolean')).toBe(true);
      expect(TypeValidator.validateType(false, 'boolean')).toBe(true);
      expect(TypeValidator.validateType(1, 'boolean')).toBe(false);
    });

    it('should validate object type', () => {
      expect(TypeValidator.validateType({}, 'object')).toBe(true);
      expect(TypeValidator.validateType({ foo: 'bar' }, 'object')).toBe(true);
      expect(TypeValidator.validateType([], 'object')).toBe(false);
      expect(TypeValidator.validateType(null, 'object')).toBe(false);
    });

    it('should validate array type', () => {
      expect(TypeValidator.validateType([], 'array')).toBe(true);
      expect(TypeValidator.validateType([1, 2, 3], 'array')).toBe(true);
      expect(TypeValidator.validateType({}, 'array')).toBe(false);
    });

    it('should validate null type', () => {
      expect(TypeValidator.validateType(null, 'null')).toBe(true);
      expect(TypeValidator.validateType(undefined, 'null')).toBe(false);
    });

    it('should validate undefined type', () => {
      expect(TypeValidator.validateType(undefined, 'undefined')).toBe(true);
      expect(TypeValidator.validateType(null, 'undefined')).toBe(false);
    });
  });

  describe('getType', () => {
    it('should get type of primitives', () => {
      expect(TypeValidator.getType('string')).toBe('string');
      expect(TypeValidator.getType(123)).toBe('number');
      expect(TypeValidator.getType(true)).toBe('boolean');
    });

    it('should get type of null and undefined', () => {
      expect(TypeValidator.getType(null)).toBe('null');
      expect(TypeValidator.getType(undefined)).toBe('undefined');
    });

    it('should get type of array', () => {
      expect(TypeValidator.getType([])).toBe('array');
      expect(TypeValidator.getType([1, 2, 3])).toBe('array');
    });

    it('should get type of object', () => {
      expect(TypeValidator.getType({})).toBe('object');
      expect(TypeValidator.getType({ foo: 'bar' })).toBe('object');
    });
  });
});

describe('StateValidator', () => {
  let validator: StateValidator;

  beforeEach(() => {
    validator = new StateValidator();
  });

  describe('registerSchema', () => {
    it('should register schema', () => {
      const schema = createSchema('test', { name: z.string() });
      validator.registerSchema(schema);
      expect(validator.getSchema('test')).toBeDefined();
    });

    it('should unregister schema', () => {
      const schema = createSchema('test', { name: z.string() });
      validator.registerSchema(schema);
      validator.unregisterSchema('test');
      expect(validator.getSchema('test')).toBeUndefined();
    });
  });

  describe('validateBasic', () => {
    it('should validate simple state', () => {
      const result = validator.validateBasic({ foo: 'bar' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular references', () => {
      const circular: any = { foo: 'bar' };
      circular.self = circular;

      const result = validator.validateBasic(circular);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CIRCULAR_REFERENCE')).toBe(true);
    });

    it('should warn about undefined values', () => {
      const result = validator.validateBasic({ foo: undefined });
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'UNDEFINED_VALUE')).toBe(true);
    });
  });

  describe('validateWithSchema', () => {
    it('should validate with Zod schema', () => {
      const schema = createSchema('test', {
        name: z.string(),
        age: z.number()
      });

      const validState = { name: 'John', age: 30 };
      const invalidState = { name: 123, age: '30' };

      const validResult = validator.validateWithSchema(validState, schema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateWithSchema(invalidState, schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should validate nested objects', () => {
      const schema = createSchema('test', {
        user: z.object({
          name: z.string(),
          email: z.string().email()
        })
      });

      const validState = { user: { name: 'John', email: 'john@example.com' } };
      const result = validator.validateWithSchema(validState, schema);
      expect(result.valid).toBe(true);
    });

    it('should validate arrays', () => {
      const schema = createSchema('test', {
        items: z.array(z.number())
      });

      const validState = { items: [1, 2, 3] };
      const result = validator.validateWithSchema(validState, schema);
      expect(result.valid).toBe(true);
    });

    it('should validate optional fields', () => {
      const schema = createSchema('test', {
        name: z.string(),
        age: z.number().optional()
      });

      const validState = { name: 'John' };
      const result = validator.validateWithSchema(validState, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateProperty', () => {
    it('should validate property at path', () => {
      const state = { user: { name: 'John', age: 30 } };
      const schema = z.string();

      const result = validator.validateProperty(state, 'user.name', schema);
      expect(result.valid).toBe(true);
    });

    it('should handle invalid property', () => {
      const state = { user: { name: 123 } };
      const schema = z.string();

      const result = validator.validateProperty(state, 'user.name', schema);
      expect(result.valid).toBe(false);
    });

    it('should handle missing property', () => {
      const state = { user: {} };
      const schema = z.string();

      const result = validator.validateProperty(state, 'user.name', schema);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateConstraints', () => {
    it('should validate max length constraint', () => {
      const constraints = StateValidator.createConstraints();
      const maxLength = constraints.maxLength<string>(5);

      const validResult = validator.validateConstraints('hello', [maxLength]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints('hello world', [maxLength]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate min length constraint', () => {
      const constraints = StateValidator.createConstraints();
      const minLength = constraints.minLength<string>(3);

      const validResult = validator.validateConstraints('hello', [minLength]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints('hi', [minLength]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate range constraint', () => {
      const constraints = StateValidator.createConstraints();
      const range = constraints.range(1, 10);

      const validResult = validator.validateConstraints(5, [range]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints(15, [range]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate positive constraint', () => {
      const constraints = StateValidator.createConstraints();
      const positive = constraints.positive();

      const validResult = validator.validateConstraints(5, [positive]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints(-5, [positive]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate pattern constraint', () => {
      const constraints = StateValidator.createConstraints();
      const pattern = constraints.pattern(/^\d{3}-\d{3}-\d{4}$/, 'phone');

      const validResult = validator.validateConstraints('123-456-7890', [pattern]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints('abc', [pattern]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate email constraint', () => {
      const constraints = StateValidator.createConstraints();
      const email = constraints.email();

      const validResult = validator.validateConstraints('test@example.com', [email]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints('not-an-email', [email]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate URL constraint', () => {
      const constraints = StateValidator.createConstraints();
      const url = constraints.url();

      const validResult = validator.validateConstraints('https://example.com', [url]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints('not-a-url', [url]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate oneOf constraint', () => {
      const constraints = StateValidator.createConstraints();
      const oneOf = constraints.oneOf(['red', 'green', 'blue']);

      const validResult = validator.validateConstraints('red', [oneOf]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints('yellow', [oneOf]);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate custom constraint', () => {
      const constraints = StateValidator.createConstraints();
      const custom = constraints.custom('even', (value: number) => value % 2 === 0, 'Value must be even');

      const validResult = validator.validateConstraints(4, [custom]);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateConstraints(5, [custom]);
      expect(invalidResult.valid).toBe(false);
    });
  });
});

describe('Built-in Schemas', () => {
  it('should create langGraph state schema', () => {
    const schemas = createBuiltInSchemas();
    const schema = schemas.langGraphState({ customField: z.string() });

    expect(schema).toBeDefined();
  });

  it('should create agent state schema', () => {
    const schemas = createBuiltInSchemas();
    const schema = schemas.agentState({ customField: z.number() });

    expect(schema).toBeDefined();
  });

  it('should create session state schema', () => {
    const schemas = createBuiltInSchemas();
    const schema = schemas.sessionState({ customField: z.boolean() });

    expect(schema).toBeDefined();
  });

  it('should create thread state schema', () => {
    const schemas = createBuiltInSchemas();
    const schema = schemas.threadState({ customField: z.array(z.string()) });

    expect(schema).toBeDefined();
  });
});

describe('Factory Functions', () => {
  it('should create validator', () => {
    const validator = createValidator();
    expect(validator).toBeInstanceOf(StateValidator);
  });

  it('should validate state with Zod schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });

    const validState = { name: 'John', age: 30 };
    const result = validateState(validState, schema);

    expect(result.valid).toBe(true);
  });

  it('should create schema from shape', () => {
    const schema = createSchema('test', {
      name: z.string(),
      age: z.number()
    });

    expect(schema.name).toBe('test');
    expect(schema.version).toBe('1.0.0');
  });

  it('should validate nested property', () => {
    const state = { user: { name: 'John' } };
    const schema = z.string();

    const result = validateNestedProperty(state, 'user.name', schema);
    expect(result.valid).toBe(true);
  });
});
