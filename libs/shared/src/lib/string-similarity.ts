/**
 * Compares the similarity between two strings using the Sørensen-Dice coefficient
 * with n-gram comparison. Uses multiset approach where duplicate n-grams are counted.
 * @param str1 The first string to compare.
 * @param str2 The second string to compare.
 * @param gramSize The size of the n-grams. Defaults to 2 (bigrams).
 * @returns A number between 0 and 1, where 1 means identical strings.
 */
export function stringSimilarity(str1: string, str2: string, gramSize = 2) {
  if (!str1?.length || !str2?.length) {
    return 0.0;
  }

  const pairs1 = getNGrams(str1, gramSize);
  const pairs2 = getNGrams(str2, gramSize);

  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();

  for (const gram of pairs1) {
    freq1.set(gram, (freq1.get(gram) || 0) + 1);
  }
  for (const gram of pairs2) {
    freq2.set(gram, (freq2.get(gram) || 0) + 1);
  }

  let intersection = 0;
  for (const [gram, count1] of freq1) {
    const count2 = freq2.get(gram) || 0;
    intersection += Math.min(count1, count2);
  }

  return (2 * intersection) / (pairs1.length + pairs2.length);
}

function getNGrams(s: string, len: number) {
  s = ' '.repeat(len - 1) + s.toLowerCase() + ' '.repeat(len - 1);
  const v = new Array(s.length - len + 1);
  for (let i = 0; i < v.length; i++) {
    v[i] = s.slice(i, i + len);
  }
  return v;
}
