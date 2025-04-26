// 模拟Chrome API
const chrome = {
  runtime: {
    onMessage: {
      addListener: (callback) => {
        // 存储消息处理函数
        chrome.runtime.messageHandler = callback;
      }
    },
    sendMessage: (message) => {
      console.log('发送消息:', message);
      // 模拟异步响应
      return Promise.resolve({ success: true });
    },
    messageHandler: null
  },
  storage: {
    sync: {
      get: (key, callback) => {
        console.log('获取存储数据:', key);
        // 模拟返回空数据
        callback({});
      },
      set: (data, callback) => {
        console.log('设置存储数据:', data);
        if (callback) callback();
      }
    },
    local: {
      get: (key, callback) => {
        console.log('获取本地存储数据:', key);
        callback({});
      },
      set: (data, callback) => {
        console.log('设置本地存储数据:', data);
        if (callback) callback();
      }
    },
    onChanged: {
      addListener: (callback) => {
        console.log('添加存储变化监听器');
        chrome.storage.onChangedListener = callback;
      }
    },
    onChangedListener: null
  },
  tabs: {
    query: (queryInfo) => {
      console.log('查询标签页:', queryInfo);
      // 模拟返回一些标签页
      return Promise.resolve([
        { id: 1, url: 'https://example.com/page1', groupId: -1 },
        { id: 2, url: 'https://example.com/page2', groupId: -1 },
        { id: 3, url: 'https://github.com/user/repo', groupId: -1 },
        { id: 4, url: 'https://github.com/user/another-repo', groupId: -1 }
      ]);
    },
    get: (tabId) => {
      console.log('获取标签页:', tabId);
      // 模拟返回标签页
      return Promise.resolve({
        id: tabId,
        url: tabId === 1 ? 'https://example.com/page1' :
             tabId === 2 ? 'https://example.com/page2' :
             tabId === 3 ? 'https://github.com/user/repo' :
             'https://github.com/user/another-repo',
        groupId: -1
      });
    },
    group: (options) => {
      console.log('创建标签组:', options);
      // 模拟返回组ID
      return Promise.resolve(100);
    },
    ungroup: (tabId) => {
      console.log('取消标签页分组:', tabId);
      return Promise.resolve();
    },
    move: (tabIds, moveProperties) => {
      console.log('移动标签页:', tabIds, moveProperties);
      return Promise.resolve();
    },
    onCreated: {
      addListener: (callback) => {
        chrome.tabs.createdListener = callback;
      }
    },
    onUpdated: {
      addListener: (callback) => {
        chrome.tabs.updatedListener = callback;
      }
    },
    onGroupChanged: {
      addListener: (callback) => {
        chrome.tabs.groupChangedListener = callback;
      }
    },
    onMoved: {
      addListener: (callback) => {
        chrome.tabs.movedListener = callback;
      }
    },
    onActivated: {
      addListener: (callback) => {
        chrome.tabs.activatedListener = callback;
      }
    },
    onRemoved: {
      addListener: (callback) => {
        chrome.tabs.removedListener = callback;
      }
    },
    createdListener: null,
    updatedListener: null,
    groupChangedListener: null,
    movedListener: null,
    activatedListener: null,
    removedListener: null
  },
  tabGroups: {
    update: (groupId, updateProperties) => {
      console.log('更新标签组:', groupId, updateProperties);
      return Promise.resolve();
    },
    query: (queryInfo) => {
      console.log('查询标签组:', queryInfo);
      // 模拟返回一些标签组
      return Promise.resolve([
        { id: 100, title: 'example.com', color: 'blue', windowId: 1 },
        { id: 101, title: 'github.com', color: 'red', windowId: 1 }
      ]);
    },
    get: (groupId) => {
      console.log('获取标签组:', groupId);
      // 模拟返回标签组
      return Promise.resolve({
        id: groupId,
        title: groupId === 100 ? 'example.com' : 'github.com',
        color: groupId === 100 ? 'blue' : 'red',
        windowId: 1
      });
    },
    onUpdated: {
      addListener: (callback) => {
        chrome.tabGroups.updatedListener = callback;
      }
    },
    onCreated: {
      addListener: (callback) => {
        chrome.tabGroups.createdListener = callback;
      }
    },
    updatedListener: null,
    createdListener: null
  },
  windows: {
    WINDOW_ID_CURRENT: 1
  },
  i18n: {
    getMessage: (messageName, substitutions) => {
      return messageName;
    }
  }
};

// 全局变量，用于存储测试结果
let testResults = {
  success: 0,
  failure: 0,
  messages: []
};

// 测试函数
function runTest(testName, testFunction) {
  console.log(`\n开始测试: ${testName}`);
  try {
    testFunction();
    testResults.success++;
    testResults.messages.push(`✅ ${testName} - 成功`);
    console.log(`✅ 测试成功: ${testName}`);
  } catch (error) {
    testResults.failure++;
    testResults.messages.push(`❌ ${testName} - 失败: ${error.message}`);
    console.error(`❌ 测试失败: ${testName}`, error);
  }
}

// 断言函数
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "断言失败");
  }
}

// 模拟等待
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 加载background.js
// 注意：这里我们假设background.js中的代码会在全局作用域中执行
// 实际上我们需要手动执行一些测试

// 测试1: 测试消息处理 - 测试消息
async function testTestMessage() {
  const response = await new Promise(resolve => {
    chrome.runtime.messageHandler(
      { action: 'test', data: 'Hello World' },
      null,
      resolve
    );
  });

  assert(response.success === true, "测试消息响应应该成功");
  assert(response.message.includes('Hello World'), "测试消息响应应该包含发送的数据");
}

// 测试2: 测试消息处理 - 获取扩展状态
async function testGetExtensionStatus() {
  const response = await new Promise(resolve => {
    chrome.runtime.messageHandler(
      { action: 'getExtensionStatus' },
      null,
      resolve
    );
  });

  assert(response.success === true, "获取扩展状态响应应该成功");
  assert(response.active !== undefined, "获取扩展状态响应应该包含active属性");
  assert(response.settings !== undefined, "获取扩展状态响应应该包含settings属性");
}

// 测试3: 测试消息处理 - 切换扩展激活状态
async function testToggleExtensionActive() {
  // 获取当前状态
  const initialResponse = await new Promise(resolve => {
    chrome.runtime.messageHandler(
      { action: 'getExtensionStatus' },
      null,
      resolve
    );
  });

  const initialState = initialResponse.active;

  // 切换状态
  const toggleResponse = await new Promise(resolve => {
    chrome.runtime.messageHandler(
      { action: 'toggleExtensionActive', active: !initialState },
      null,
      resolve
    );
  });

  assert(toggleResponse.success === true, "切换扩展激活状态响应应该成功");
  assert(toggleResponse.active === !initialState, "切换后的状态应该与初始状态相反");

  // 再次获取状态，确认已切换
  const finalResponse = await new Promise(resolve => {
    chrome.runtime.messageHandler(
      { action: 'getExtensionStatus' },
      null,
      resolve
    );
  });

  assert(finalResponse.active === !initialState, "切换后的状态应该保持");
}

// 测试4: 测试消息处理 - 按域名分组
async function testGroupByDomain() {
  // 这个测试比较复杂，因为它涉及到异步操作和多个API调用
  // 我们只测试消息处理部分

  let responseReceived = false;

  const response = await new Promise(resolve => {
    chrome.runtime.messageHandler(
      { action: 'groupByDomain' },
      null,
      (resp) => {
        responseReceived = true;
        resolve(resp);
      }
    );
  });

  assert(responseReceived, "应该收到响应");
  assert(response.success === true, "按域名分组响应应该成功");
  assert(response.status === 'processing', "按域名分组响应应该包含processing状态");

  // 等待异步操作完成
  await wait(100);
}

// 测试5: 测试消息处理 - 未知消息
async function testUnknownMessage() {
  const response = await new Promise(resolve => {
    chrome.runtime.messageHandler(
      { action: 'unknownAction' },
      null,
      resolve
    );
  });

  assert(response.success === false, "未知消息响应应该失败");
  assert(response.error === 'Unknown action', "未知消息响应应该包含错误信息");
}

// 运行测试
async function runTests() {
  console.log("开始运行测试...");

  // 运行测试
  await runTest("测试消息处理 - 测试消息", testTestMessage);
  await runTest("测试消息处理 - 获取扩展状态", testGetExtensionStatus);
  await runTest("测试消息处理 - 切换扩展激活状态", testToggleExtensionActive);
  await runTest("测试消息处理 - 按域名分组", testGroupByDomain);
  await runTest("测试消息处理 - 未知消息", testUnknownMessage);

  // 输出测试结果
  console.log("\n测试结果:");
  console.log(`总共: ${testResults.success + testResults.failure} 测试`);
  console.log(`成功: ${testResults.success} 测试`);
  console.log(`失败: ${testResults.failure} 测试`);

  if (testResults.failure > 0) {
    console.log("\n失败的测试:");
    testResults.messages.filter(m => m.startsWith('❌')).forEach(m => console.log(m));
  }
}

// 导出测试函数，以便在Node.js环境中运行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests };
}

// 如果直接运行此脚本，则执行测试
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}
