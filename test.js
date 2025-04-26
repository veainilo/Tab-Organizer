// 测试 background.js 是否正确加载和响应消息
console.log('测试脚本已加载');

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM 已加载，设置测试按钮事件');

  // 设置测试按钮事件
  document.getElementById('testConnection').addEventListener('click', function() {
    console.log('点击测试连接按钮');
    testBackgroundConnection();
  });

  document.getElementById('testGroupByDomain').addEventListener('click', function() {
    console.log('点击测试分组按钮');
    testGroupByDomain();
  });

  document.getElementById('testUngroupAll').addEventListener('click', function() {
    console.log('点击测试取消分组按钮');
    testUngroupAll();
  });

  document.getElementById('testSortTabGroups').addEventListener('click', function() {
    console.log('点击测试排序按钮');
    testSortTabGroups();
  });

  document.getElementById('testGetSortingMetrics').addEventListener('click', function() {
    console.log('点击测试获取指标按钮');
    testGetSortingMetrics();
  });
});

// 测试发送消息到 background.js
console.log('发送初始测试消息到 background.js');
try {
  chrome.runtime.sendMessage({ action: 'test', data: 'Hello from test.js' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('发送消息失败:', chrome.runtime.lastError);
    } else {
      console.log('测试消息响应:', response);
    }
  });
} catch (error) {
  console.error('发送消息时出错:', error);
}

// 导出一个测试函数，可以从控制台调用
window.testBackgroundConnection = function() {
  console.log('测试 background 连接');
  try {
    chrome.runtime.sendMessage({ action: 'test', data: 'Manual test' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送测试消息失败:', chrome.runtime.lastError);
      } else {
        console.log('测试消息响应:', response);
      }
    });
  } catch (error) {
    console.error('发送测试消息时出错:', error);
  }
};

// 测试 groupByDomain 功能
window.testGroupByDomain = function() {
  console.log('测试 groupByDomain 功能');
  try {
    chrome.runtime.sendMessage({ action: 'groupByDomain' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送 groupByDomain 消息失败:', chrome.runtime.lastError);
      } else {
        console.log('groupByDomain 响应:', response);
      }
    });
  } catch (error) {
    console.error('发送 groupByDomain 消息时出错:', error);
  }
};

// 测试 ungroupAll 功能
window.testUngroupAll = function() {
  console.log('测试 ungroupAll 功能');
  try {
    chrome.runtime.sendMessage({ action: 'ungroupAll' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送 ungroupAll 消息失败:', chrome.runtime.lastError);
      } else {
        console.log('ungroupAll 响应:', response);
      }
    });
  } catch (error) {
    console.error('发送 ungroupAll 消息时出错:', error);
  }
};

// 测试 sortTabGroups 功能
window.testSortTabGroups = function() {
  console.log('测试 sortTabGroups 功能');
  try {
    chrome.runtime.sendMessage({ action: 'sortTabGroups' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送 sortTabGroups 消息失败:', chrome.runtime.lastError);
      } else {
        console.log('sortTabGroups 响应:', response);
      }
    });
  } catch (error) {
    console.error('发送 sortTabGroups 消息时出错:', error);
  }
};

// 测试 getSortingMetrics 功能
window.testGetSortingMetrics = function() {
  console.log('测试 getSortingMetrics 功能');
  try {
    chrome.runtime.sendMessage({ action: 'getSortingMetrics' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送 getSortingMetrics 消息失败:', chrome.runtime.lastError);
      } else {
        console.log('getSortingMetrics 响应:', response);
      }
    });
  } catch (error) {
    console.error('发送 getSortingMetrics 消息时出错:', error);
  }
};
