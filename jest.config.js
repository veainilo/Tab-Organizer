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
  ],
  // 自动模拟所需模块
  automock: false,
  // 清除每次测试前的模拟
  clearMocks: true,
  // 显示详细的覆盖率信息
  coverageReporters: ['text', 'lcov'],
  // 目录清理
  resetModules: true
}; 