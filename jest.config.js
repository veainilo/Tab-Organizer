module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/popup/main.js',
    '!js/background.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ]
}; 