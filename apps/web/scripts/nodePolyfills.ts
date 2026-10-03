import { JSDOM } from 'jsdom';

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
