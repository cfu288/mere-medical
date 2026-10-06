import { JSDOM } from 'jsdom';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';

for (const ext of ['.svg', '.png', '.jpg', '.css', '.woff2']) {
  require.extensions[ext] = () => undefined;
}

const dom = new JSDOM();
const globals = globalThis as Record<string, unknown>;
globals['window'] ??= dom.window;
globals['document'] ??= dom.window.document;
globals['DOMParser'] ??= dom.window.DOMParser;
globals['Element'] ??= dom.window.Element;
globals['Node'] ??= dom.window.Node;
globals['pdfjsWorker'] ??= pdfjsWorker;
const promise = Promise as typeof Promise & {
  try?: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
};
promise.try ??= (fn, ...args) => new Promise((resolve) => resolve(fn(...args)));
const bytes = Uint8Array.prototype as Uint8Array & { toHex?: () => string };
bytes.toHex ??= function (this: Uint8Array) {
  return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('');
};
