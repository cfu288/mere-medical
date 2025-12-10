import { flattenObject } from './flattenObject';

describe('flattenObject', () => {
  describe('basic object flattening', () => {
    it('should return object with empty key for empty input', () => {
      const result = flattenObject({});
      expect(result).toEqual({ '': {} });
    });

    it('should handle flat objects without modification', () => {
      const input = { a: 1, b: 'string', c: true };
      const result = flattenObject(input);
      expect(result).toEqual({ a: 1, b: 'string', c: true });
    });

    it('should handle null values', () => {
      const input = { a: null, b: 1 };
      const result = flattenObject(input);
      expect(result).toEqual({ a: null, b: 1 });
    });

    it('should handle undefined values', () => {
      const input = { a: undefined, b: 1 };
      const result = flattenObject(input);
      expect(result).toEqual({ a: undefined, b: 1 });
    });

    it('should handle boolean values', () => {
      const input = { a: true, b: false };
      const result = flattenObject(input);
      expect(result).toEqual({ a: true, b: false });
    });

    it('should handle number values including zero', () => {
      const input = { a: 0, b: -1, c: 3.14 };
      const result = flattenObject(input);
      expect(result).toEqual({ a: 0, b: -1, c: 3.14 });
    });
  });

  describe('nested object flattening', () => {
    it('should flatten one level of nesting', () => {
      const input = { a: 1, b: { c: 2 } };
      const result = flattenObject(input);
      expect(result).toEqual({ a: 1, 'b.c': 2 });
    });

    it('should flatten multiple levels of nesting', () => {
      const input = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3,
            f: {
              g: 4,
            },
          },
        },
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        a: 1,
        'b.c': 2,
        'b.d.e': 3,
        'b.d.f.g': 4,
      });
    });

    it('should handle multiple nested branches', () => {
      const input = {
        user: {
          name: 'John',
          age: 30,
          address: {
            street: '123 Main St',
            city: 'NYC',
          },
        },
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        'user.name': 'John',
        'user.age': 30,
        'user.address.street': '123 Main St',
        'user.address.city': 'NYC',
        'settings.theme': 'dark',
        'settings.notifications.email': true,
        'settings.notifications.push': false,
      });
    });

    it('should handle empty nested objects', () => {
      const input = { a: 1, b: {}, c: { d: {} } };
      const result = flattenObject(input);
      expect(result).toEqual({
        a: 1,
        b: {},
        'c.d': {},
      });
    });
  });

  describe('array handling', () => {
    it('should handle arrays at the root level', () => {
      const input = [1, 2, 3];
      const result = flattenObject(input);
      expect(result).toEqual({
        '[0]': 1,
        '[1]': 2,
        '[2]': 3,
      });
    });

    it('should handle empty arrays', () => {
      const input: any[] = [];
      const result = flattenObject(input);
      expect(result).toEqual({ '': [] });
    });

    it('should handle arrays within objects', () => {
      const input = {
        name: 'Test',
        values: [1, 2, 3],
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        name: 'Test',
        'values[0]': 1,
        'values[1]': 2,
        'values[2]': 3,
      });
    });

    it('should handle objects within arrays', () => {
      const input = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        'items[0].id': 1,
        'items[0].name': 'Item 1',
        'items[1].id': 2,
        'items[1].name': 'Item 2',
      });
    });

    it('should handle nested arrays', () => {
      const input = {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        'matrix[0][0]': 1,
        'matrix[0][1]': 2,
        'matrix[1][0]': 3,
        'matrix[1][1]': 4,
      });
    });

    it('should handle arrays with mixed types', () => {
      const input = {
        mixed: [1, 'string', { key: 'value' }, [2, 3], null],
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        'mixed[0]': 1,
        'mixed[1]': 'string',
        'mixed[2].key': 'value',
        'mixed[3][0]': 2,
        'mixed[3][1]': 3,
        'mixed[4]': null,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle objects with null prototype', () => {
      const obj = Object.create(null);
      obj.a = 1;
      obj.b = { c: 2 };

      const result = flattenObject(obj);
      expect(result).toEqual({ a: 1, 'b.c': 2 });
    });

    it('should handle objects with inherited properties', () => {
      class Parent {
        inherited = 'from parent';
      }
      class Child extends Parent {
        own = 'from child';
      }
      const obj = new Child();

      const result = flattenObject(obj);
      // for...in loops iterate over inherited enumerable properties
      expect(result).toEqual({ inherited: 'from parent', own: 'from child' });
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const input = { date };
      const result = flattenObject(input);
      // Date objects are treated as primitives
      expect(result).toEqual({ date });
    });

    it('should handle functions as values', () => {
      const fn = () => 'test';
      const input = { callback: fn };
      const result = flattenObject(input);
      expect(result).toEqual({ callback: fn });
    });

    it('should handle symbols as values', () => {
      const sym = Symbol('test');
      const input = { symbol: sym };
      const result = flattenObject(input);
      expect(result).toEqual({ symbol: sym });
    });

    it('should handle objects with numeric keys', () => {
      const input = { '0': 'zero', '1': 'one', a: 'letter' };
      const result = flattenObject(input);
      expect(result).toEqual({ '0': 'zero', '1': 'one', a: 'letter' });
    });

    it('should handle deeply nested empty structures', () => {
      const input = { a: { b: { c: { d: {} } } } };
      const result = flattenObject(input);
      expect(result).toEqual({ 'a.b.c.d': {} });
    });

    it('should handle special characters in keys', () => {
      const input = {
        'key.with.dots': 'value1',
        'key[with]brackets': 'value2',
        'key with spaces': 'value3',
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        'key.with.dots': 'value1',
        'key[with]brackets': 'value2',
        'key with spaces': 'value3',
      });
    });

    it('should not modify the original object', () => {
      const input = { a: 1, b: { c: 2 } };
      const originalCopy = JSON.parse(JSON.stringify(input));
      flattenObject(input);
      expect(input).toEqual(originalCopy);
    });

    it('should properly detect what is an object vs primitive', () => {
      // The function uses Object(value) !== value to detect primitives
      // This test verifies that behavior
      const input = {
        // Primitives (Object(x) !== x returns true, so not flattened further)
        string: 'test',
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined,
        symbol: Symbol('test'),

        // Objects (Object(x) === x returns true, so these get flattened)
        plainObject: { nested: 'value' },
        array: [1, 2],
        date: new Date('2024-01-01'),
        regex: /test/gi,
        error: new Error('test'),

        // Functions are objects but Object(fn) === fn
        function: () => {},
      };

      const result = flattenObject(input);

      // Primitives stay as-is
      expect(result.string).toBe('test');
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.nullValue).toBe(null);
      expect(result.undefinedValue).toBe(undefined);
      expect(typeof result.symbol).toBe('symbol');

      // Objects get flattened (except special objects that pass the Object() test)
      expect(result['plainObject.nested']).toBe('value');
      expect(result['array[0]']).toBe(1);
      expect(result['array[1]']).toBe(2);

      // Special objects that are treated as primitives by Object() !== check
      expect(result.date).toBeInstanceOf(Date);
      expect(result.regex).toBeInstanceOf(RegExp);
      expect(result.error).toBeInstanceOf(Error);
      expect(typeof result.function).toBe('function');
    });
  });

  describe('real-world medical data scenarios', () => {
    it('should flatten FHIR resource-like structures', () => {
      const input = {
        resourceType: 'Patient',
        id: '123',
        name: [
          {
            use: 'official',
            family: 'Smith',
            given: ['John', 'Jacob'],
          },
        ],
        address: [
          {
            city: 'Boston',
            state: 'MA',
          },
        ],
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        resourceType: 'Patient',
        id: '123',
        'name[0].use': 'official',
        'name[0].family': 'Smith',
        'name[0].given[0]': 'John',
        'name[0].given[1]': 'Jacob',
        'address[0].city': 'Boston',
        'address[0].state': 'MA',
      });
    });

    it('should handle observation data with codes', () => {
      const input = {
        resourceType: 'Observation',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '29463-7',
              display: 'Body Weight',
            },
          ],
        },
        valueQuantity: {
          value: 70,
          unit: 'kg',
          system: 'http://unitsofmeasure.org',
        },
      };
      const result = flattenObject(input);
      expect(result).toEqual({
        resourceType: 'Observation',
        'code.coding[0].system': 'http://loinc.org',
        'code.coding[0].code': '29463-7',
        'code.coding[0].display': 'Body Weight',
        'valueQuantity.value': 70,
        'valueQuantity.unit': 'kg',
        'valueQuantity.system': 'http://unitsofmeasure.org',
      });
    });
  });
});
