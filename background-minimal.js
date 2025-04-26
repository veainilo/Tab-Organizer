// 最小化版 background.js
console.log('Edge Tab Organizer - 最小化版 Background Service Worker 已启动');

// 常量定义
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;
const TAB_GROUP_ID_NONE = -1;

// 基本设置
let settings = {
  extensionActive: true,
  autoGroupByDomain: true,
  autoGroupOnCreation: true,
  groupByRootDomain: true,
  ignoreTLD: true,
  useDynamicColors: true,
  enableTabSorting: true,
  sortingMethod: 'domain',
  sortAscending: true,
  enableGroupSorting: true,
  groupSortingMethod: 'smart',
  groupSortAscending: true,
  excludeDomains: [],
  colorScheme: {
    'default': 'blue'
  }
};

// 可用的标签组颜色
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return '';
  }
}

// Get domain for grouping based on settings
function getDomainForGrouping(url) {
  return extractDomain(url);
}

// 为域名获取颜色
function getColorForDomain(domain) {
  // 简化版：使用域名的哈希值来确定颜色
  const hash = domain.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  return baseColors[hash % baseColors.length];
}

// 按域名分组标签页 - 简化版
async function groupTabsByDomain() {
  console.log('开始按域名分组标签页 - 简化版');

  try {
    // 获取当前窗口的所有标签页
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs.length, '个');

    if (!tabs || tabs.length === 0) {
      console.log('没有标签页，退出');
      return true;
    }

    // 按域名分组
    const domainGroups = {};

    for (const tab of tabs) {
      if (!tab.url) continue;

      const domain = getDomainForGrouping(tab.url);
      if (!domain) continue;

      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }

      domainGroups[domain].push(tab.id);
    }

    console.log('域名分组结果:', Object.keys(domainGroups).length, '个组');

    // 创建标签组
    for (const domain in domainGroups) {
      const tabIds = domainGroups[domain];
      console.log('处理域名:', domain, '标签页数量:', tabIds.length);

      // 创建新组
      const groupId = await chrome.tabs.group({ tabIds });
      console.log('新组创建成功，ID:', groupId);

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: color
      });
      console.log('组标题和颜色已设置');
    }

    console.log('分组完成');
    return true;
  } catch (error) {
    console.error('Error grouping tabs by domain:', error);
    return false;
  }
}

// 取消所有标签页分组 - 简化版
async function ungroupAllTabs() {
  console.log('开始取消所有标签页分组 - 简化版');

  // 如果插件处于激活状态，不允许取消分组
  if (settings.extensionActive) {
    console.log('插件处于激活状态，不允许取消分组');
    return { success: false, error: 'Extension is active, ungrouping is not allowed' };
  }

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs.length, '个');

    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tab.id);
      }
    }

    console.log('取消分组完成');
    return { success: true };
  } catch (error) {
    console.error('Error ungrouping all tabs:', error);
    return { success: false, error: error.message };
  }
}

// 对标签组进行排序 - 简化版
async function sortTabGroups() {
  console.log('开始对标签组进行排序 - 简化版');

  try {
    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
    console.log('查询到的标签组:', groups.length, '个');

    if (!groups || groups.length <= 1) {
      console.log('标签组数量不足，无需排序');
      return true;
    }

    // 获取每个组的智能排序分数
    const groupScores = {};

    for (const group of groups) {
      // 获取组内标签页数量
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const size = tabs.length;

      // 计算智能排序分数（简化版，仅使用标签页数量）
      const score = size / 10; // 最多10个标签页得满分

      groupScores[group.id] = score;
    }

    // 根据分数对组进行排序
    let sortedGroups = [...groups];
    sortedGroups.sort((a, b) => {
      const scoreA = groupScores[a.id] || 0;
      const scoreB = groupScores[b.id] || 0;

      return settings.groupSortAscending ?
        scoreA - scoreB :
        scoreB - scoreA;
    });

    console.log('排序后的标签组:', sortedGroups.length, '个');

    // 移动标签组
    const newPositions = {};
    let currentIndex = 0;

    // 计算每个组的新起始位置
    for (const group of sortedGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      newPositions[group.id] = currentIndex;
      currentIndex += tabs.length;
    }

    // 从后向前移动标签页
    for (let i = sortedGroups.length - 1; i >= 0; i--) {
      const group = sortedGroups[i];
      const tabs = await chrome.tabs.query({ groupId: group.id });

      if (tabs.length > 0) {
        const tabIds = tabs.map(tab => tab.id);
        await chrome.tabs.move(tabIds, { index: newPositions[group.id] });
      }
    }

    console.log('标签组排序完成');
    return true;
  } catch (error) {
    console.error('Error sorting tab groups:', error);
    return false;
  }
}

// 获取排序指标 - 简化版
async function getSortingMetrics() {
  console.log('获取排序指标 - 简化版');

  try {
    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
    console.log('查询到的标签组:', groups.length, '个');

    if (!groups || groups.length === 0) {
      console.log('没有标签组，返回空指标');
      return {
        success: true,
        metrics: {},
        sortingMethod: settings.groupSortingMethod,
        sortAscending: settings.groupSortAscending
      };
    }

    // 为每个组创建指标数据
    const metrics = {};
    const now = Date.now();

    for (const group of groups) {
      // 获取组内标签页数量
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const size = tabs.length;

      // 创建随机的访问时间和创建时间（实际应用中应该使用真实数据）
      const accessTime = now - Math.random() * 3600000; // 1小时内的随机时间
      const createTime = now - Math.random() * 86400000; // 1天内的随机时间

      // 计算智能排序的各项分数
      const accessScore = Math.random(); // 随机分数，实际应用中应基于真实数据
      const sizeScore = Math.min(size / 10, 1); // 最多10个标签页得满分
      const createScore = Math.random();

      // 计算最终分数（加权平均）
      const accessWeight = 0.5;
      const sizeWeight = 0.3;
      const createWeight = 0.2;
      const finalScore = (
        accessScore * accessWeight +
        sizeScore * sizeWeight +
        createScore * createWeight
      );

      metrics[group.id] = {
        title: group.title || 'Unnamed Group',
        color: group.color,
        size: size,
        accessTime: accessTime,
        createTime: createTime,
        accessTimeFormatted: new Date(accessTime).toLocaleString(),
        createTimeFormatted: new Date(createTime).toLocaleString(),
        accessScore: accessScore,
        sizeScore: sizeScore,
        createScore: createScore,
        accessWeight: accessWeight,
        sizeWeight: sizeWeight,
        createWeight: createWeight,
        finalScore: finalScore,
        sortValue: finalScore.toFixed(2) // 使用最终分数作为排序值
      };
    }

    console.log('返回排序指标:', Object.keys(metrics).length, '个组的指标');
    return {
      success: true,
      metrics: metrics,
      sortingMethod: settings.groupSortingMethod,
      sortAscending: settings.groupSortAscending
    };
  } catch (error) {
    console.error('Error getting sorting metrics:', error);
    return { success: false, error: error.message };
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('收到消息:', message);

  // 测试消息
  if (message.action === 'test') {
    console.log('收到测试消息:', message.data);
    sendResponse({ success: true, message: 'Background script received your message: ' + message.data });
    return true;
  }

  // 按域名分组标签页
  if (message.action === 'groupByDomain') {
    console.log('处理 groupByDomain 消息');

    // 立即发送一个初始响应
    sendResponse({ success: true, status: 'processing' });

    // 异步执行分组操作
    groupTabsByDomain().then(success => {
      console.log('groupByDomain 执行结果:', success);

      // 发送完成消息
      chrome.runtime.sendMessage({
        action: 'groupByDomainComplete',
        success: true
      }).catch(err => {
        console.error('发送完成消息失败:', err);
      });
    }).catch(error => {
      console.error('Error in groupByDomain:', error);

      // 发送错误消息
      chrome.runtime.sendMessage({
        action: 'groupByDomainComplete',
        success: false,
        error: error.message
      }).catch(err => {
        console.error('发送错误消息失败:', err);
      });
    });

    return true;
  }

  // 取消所有标签页分组
  if (message.action === 'ungroupAll') {
    console.log('处理 ungroupAll 消息');
    ungroupAllTabs().then(response => {
      console.log('ungroupAll 执行结果:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Error in ungroupAll:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 获取排序指标
  if (message.action === 'getSortingMetrics') {
    console.log('处理 getSortingMetrics 消息');
    getSortingMetrics().then(response => {
      console.log('getSortingMetrics 执行结果:', response.success);
      sendResponse(response);
    }).catch(error => {
      console.error('Error in getSortingMetrics:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 对标签组排序
  if (message.action === 'sortTabGroups') {
    console.log('处理 sortTabGroups 消息');
    sortTabGroups().then(success => {
      console.log('sortTabGroups 执行结果:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('Error in sortTabGroups:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 获取插件状态
  if (message.action === 'getExtensionStatus') {
    console.log('处理 getExtensionStatus 消息');
    sendResponse({
      success: true,
      active: settings.extensionActive,
      settings: settings
    });
    return true;
  }

  // 切换插件激活状态
  if (message.action === 'toggleExtensionActive') {
    console.log('处理 toggleExtensionActive 消息');
    const newState = message.active !== undefined ? message.active : !settings.extensionActive;
    settings.extensionActive = newState;

    // 如果激活了插件，自动对所有标签页进行分组
    if (settings.extensionActive) {
      groupTabsByDomain().then(() => {
        console.log('插件激活，已对所有标签页进行分组');
      }).catch(error => {
        console.error('Error grouping tabs after activation:', error);
      });
    }

    sendResponse({
      success: true,
      active: settings.extensionActive
    });
    return true;
  }

  // 未知消息
  console.warn('收到未知消息:', message);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// 输出初始化完成消息
console.log('Edge Tab Organizer - 最小化版 Background Service Worker 初始化完成');
