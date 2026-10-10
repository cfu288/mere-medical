/** Serves each url its listed body and fails on any url not listed. */
export function fakeFetch(bodies: Record<string, string>) {
  return async (url: string): Promise<Uint8Array> => {
    const body = bodies[url];
    if (body === undefined) {
      throw new Error(`no fake body for ${url}`);
    }
    return new TextEncoder().encode(body);
  };
}
