// Mock window.crypto.randomUUID for all tests
global.window = global.window || {};
global.window.crypto = global.window.crypto || {};
global.window.crypto.randomUUID = jest.fn(() => {
  // Generate a unique UUID for each call to avoid conflicts in tests
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
});
