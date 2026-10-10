module.exports = {
  displayName: 'reference-pipeline',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    '^.+\\.mjs$': [
      'babel-jest',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
        plugins: ['babel-plugin-transform-import-meta'],
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!pdfjs-dist)'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
  coverageDirectory: '../../coverage/libs/reference-pipeline',
};
