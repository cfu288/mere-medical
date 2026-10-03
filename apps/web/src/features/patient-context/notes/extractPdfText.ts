export async function extractPdfText(base64: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    const pageCount = Math.min(doc.numPages, 20);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(text);
    }
    return pages
      .join('\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  } finally {
    await task.destroy();
  }
}
