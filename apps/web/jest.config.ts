/* eslint-disable */
module.exports = {
  displayName: 'web',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
    // '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(sylviejs|kysely|react-markdown|remark-|rehype-|micromark|mdast-|unist-|unified|hast-|vfile|bail|trough|devlop|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|estree-util-is-identifier-name|decode-named-character-reference|character-entities|ccount|escape-string-regexp|markdown-table|longest-streak|zwitch|trim-lines|is-plain-obj|style-to-js|style-to-object|inline-style-parser|is-hexadecimal|is-decimal|is-alphanumerical|is-alphabetical))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testPathIgnorePatterns: ['e2e'],
  globalSetup: '<rootDir>/jest-global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest-setup-after-env.js'],
};
