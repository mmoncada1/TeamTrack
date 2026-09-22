import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom doesn't implement matchMedia; provide a minimal stub used by
// prefers-reduced-motion checks and any future responsive helpers.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// jsdom's canvas/toBlob aren't implemented; photo compression tests stub these directly where needed.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = () => null;
}
