const INSERT_CHUNK = 500;

/** Inserts rows in chunks that stay under sqlite's statement parameter limit. */
export async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
    await insert(rows.slice(start, start + INSERT_CHUNK));
  }
}
