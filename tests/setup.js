import { resetChromeApiMocks } from './mocks/chrome-api-mock';

// 启用Jest的定时器模拟
jest.useFakeTimers();

// 每个测试之前重置模拟
beforeEach(() => {
  resetChromeApiMocks();
  jest.resetAllMocks();
  jest.clearAllMocks();
}); 