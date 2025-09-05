/**
 * Flattens a multidimensional object into a single-level object with dot-notation keys
 *
 * @example
 * flattenObject({ a: 1, b: { c: 2 } })
 * // Returns: { a: 1, 'b.c': 2 }
 *
 * @example
 * flattenObject({ items: [{ id: 1 }, { id: 2 }] })
 * // Returns: { 'items[0].id': 1, 'items[1].id': 2 }
 *
 * @param input - The object or array to flatten
 * @returns A flattened object with dot-notation keys
 */
export const flattenObject = (input: unknown): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  
  /**
   * Recursively flattens an object or array
   * @param value - Current value being processed
   * @param path - Current path in dot notation
   */
  function processValue(value: unknown, path: string): void {
    // Check if value is a primitive (not an object that should be traversed)
    // This uses Object(value) !== value to detect primitives
    // Primitives: string, number, boolean, null, undefined, symbol
    // Also treated as primitives: Date, RegExp, Error, Function, etc.
    if (Object(value) !== value) {
      result[path] = value;
      return;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Empty arrays are stored as-is
        result[path] = value;
      } else {
        // Process each array element
        value.forEach((item, index) => {
          const arrayPath = `${path}[${index}]`;
          processValue(item, arrayPath);
        });
      }
      return;
    }
    
    // Handle objects
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    
    if (keys.length === 0) {
      // Empty objects are stored as-is
      result[path] = obj;
    } else {
      // Process each property
      keys.forEach(key => {
        const propertyPath = path ? `${path}.${key}` : key;
        processValue(obj[key], propertyPath);
      });
    }
  }
  
  // Start processing from the root
  processValue(input, '');
  
  return result;
};