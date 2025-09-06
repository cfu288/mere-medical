// Mock window.crypto.randomUUID for all tests
global.window = global.window || {};
global.window.crypto = global.window.crypto || {};
global.window.crypto.randomUUID = jest.fn(() => 'mock-uuid');