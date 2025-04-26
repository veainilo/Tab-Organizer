/**
 * 辅助函数，用于修复Chrome API回调模式的测试问题
 */

/**
 * 修复chrome.tabs.query等API调用中的回调问题
 * @param {Function} mockMethod - 需要修复的模拟方法
 * @param {any} returnData - 需要返回的数据
 */
export function setupCallbackMock(mockMethod, returnData) {
  // 清除之前的模拟实现
  mockMethod.mockReset();
  
  // 创建新的模拟实现，处理回调函数
  mockMethod.mockImplementation((...args) => {
    // 获取最后一个参数，它应该是回调函数
    const lastArg = args[args.length - 1];
    
    if (typeof lastArg === 'function') {
      // 如果最后一个参数是函数，则作为回调调用它
      lastArg(returnData);
    } else if (args.length === 1 && typeof args[0] === 'function') {
      // 处理只有回调函数的情况
      args[0](returnData);
    }
    
    return Promise.resolve(returnData);
  });
}

/**
 * 修复chrome.tabs.group等API调用中的Promise返回问题
 * @param {Function} mockMethod - 需要修复的模拟方法
 * @param {any} returnData - 需要返回的数据
 */
export function setupPromiseMock(mockMethod, returnData) {
  // 清除之前的模拟实现
  mockMethod.mockReset();
  
  // 创建新的模拟实现，返回Promise
  mockMethod.mockImplementation(() => {
    return Promise.resolve(returnData);
  });
}

/**
 * 一次性修复常用的Chrome API模拟
 * @param {Object} mockChrome - 模拟的Chrome API对象
 * @param {Object} mockData - 包含各API返回值的对象
 */
export function setupCommonMocks(mockChrome, mockData) {
  const { tabs, tabGroups } = mockData;
  
  // 修复tabs API
  if (tabs) {
    setupCallbackMock(mockChrome.tabs.query, tabs);
    setupPromiseMock(mockChrome.tabs.group, 1); // 返回组ID
    setupPromiseMock(mockChrome.tabs.ungroup, undefined);
    setupPromiseMock(mockChrome.tabs.move, [{ id: 1 }]);
  }
  
  // 修复tabGroups API
  if (tabGroups) {
    setupCallbackMock(mockChrome.tabGroups.query, tabGroups);
    setupPromiseMock(mockChrome.tabGroups.update, undefined);
    setupPromiseMock(mockChrome.tabGroups.move, undefined);
  }
} 