/* eslint-disable no-var */
// @ts-nocheck
/**
 * Flatten a multidimensional object
 *
 * For example:
 *   flattenObject{ a: 1, b: { c: 2 } }
 * Returns:
 *   { a: 1, c: 2}
 */
export const flattenObject = (function (isArray, wrapped) {
  return function (table) {
    return reduce('', {}, table);
  };

  function reduce(path: any, accumulator: any, table: any) {
    if (isArray(table)) {
      let length = table.length;

      if (length) {
        let index = 0;

        while (index < length) {
          var property = path + '[' + index + ']',
            item = table[index++];
          if (wrapped(item) !== item) accumulator[property] = item;
          else reduce(property, accumulator, item);
        }
      } else accumulator[path] = table;
    } else {
      var empty = true;

      if (path) {
        for (var property in table) {
          var item = table[property],
            property = path + '.' + property,
            empty = false;
          if (wrapped(item) !== item) accumulator[property] = item;
          else reduce(property, accumulator, item);
        }
      } else {
        for (var property in table) {
          var item = table[property],
            empty = false;
          if (wrapped(item) !== item) accumulator[property] = item;
          else reduce(property, accumulator, item);
        }
      }

      if (empty) accumulator[path] = table;
    }

    return accumulator;
  }
})(Array.isArray, Object);
