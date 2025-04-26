// 简化版 background.js
console.log('Edge Tab Organizer - 简化版 Background Service Worker 已启动');

// 常量定义
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;
const TAB_GROUP_ID_NONE = -1;

// 基本设置
let settings = {
  autoGroupByDomain: true,
  autoGroupOnCreation: true,
  groupByRootDomain: true,
  ignoreTLD: true,
  useDynamicColors: true,
  enableTabSorting: true,
  sortingMethod: 'domain',
  sortAscending: true,
  enableGroupSorting: true,
  groupSortingMethod: 'title',
  groupSortAscending: true,
  excludeDomains: [],
  colorScheme: {
    'default': 'blue'
  }
};

// 可用的标签组颜色
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// 提取域名
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return '';
  }
}

// 获取分组域名
function getDomainForGrouping(url) {
  const fullDomain = extractDomain(url);
  if (!fullDomain) return '';

  // 简化版：直接返回完整域名
  return fullDomain;
}

// 为域名获取颜色
function getColorForDomain(domain) {
  // 简化版：使用域名的哈希值来确定颜色
  const hash = domain.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  return baseColors[hash % baseColors.length];
}

// 按域名分组标签页
async function groupTabsByDomain() {
  console.log('开始按域名分组标签页');
  try {
    // 获取当前窗口的所有标签页
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs);

    // 按域名分组
    const domainGroups = {};

    tabs.forEach(tab => {
      if (!tab.url) {
        console.log('标签页没有URL:', tab);
        return;
      }

      const domain = getDomainForGrouping(tab.url);
      console.log('标签页域名:', tab.url, '-> 分组域名:', domain);

      if (!domain || settings.excludeDomains.includes(domain)) {
        console.log('域名为空或被排除:', domain);
        return;
      }

      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }

      domainGroups[domain].push(tab.id);
    });

    console.log('域名分组结果:', domainGroups);

    // 创建或更新标签组
    for (const domain in domainGroups) {
      const tabIds = domainGroups[domain];
      console.log('处理域名:', domain, '标签页IDs:', tabIds);

      // 创建新组
      console.log('创建新标签组，标签IDs:', tabIds);
      const groupId = await chrome.tabs.group({ tabIds });
      console.log('新组创建成功，ID:', groupId);

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      console.log('为域名设置颜色:', domain, '-> 颜色:', color);
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: color
      });
      console.log('组标题和颜色已设置');
    }

    return true;
  } catch (error) {
    console.error('Error grouping tabs by domain:', error);
    return false;
  }
}

// 取消所有标签页分组
async function ungroupAllTabs() {
  console.log('开始取消所有标签页分组');
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs);

    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        console.log('取消分组标签页:', tab);
        await chrome.tabs.ungroup(tab.id);
      }
    }

    return true;
  } catch (error) {
    console.error('Error ungrouping all tabs:', error);
    return false;
  }
}

// 对组内标签页进行排序
async function sortTabsInGroup(groupId) {
  console.log('开始对组内标签页进行排序, groupId:', groupId);
  try {
    // 获取组内所有标签
    const tabs = await chrome.tabs.query({ groupId });
    console.log('组内标签页:', tabs);

    if (!tabs || tabs.length <= 1) {
      console.log('标签页数量不足，无需排序');
      return true; // 只有一个标签不需要排序
    }

    // 根据域名对标签页进行排序
    let sortedTabs = [...tabs];
    sortedTabs.sort((a, b) => {
      const domainA = getDomainForGrouping(a.url || '');
      const domainB = getDomainForGrouping(b.url || '');

      return settings.sortAscending ?
        domainA.localeCompare(domainB) :
        domainB.localeCompare(domainA);
    });

    console.log('排序后的标签页:', sortedTabs);

    // 移动标签到新的位置
    for (let i = 0; i < sortedTabs.length; i++) {
      await chrome.tabs.move(sortedTabs[i].id, { index: i });
    }

    return true;
  } catch (error) {
    console.error('Error sorting tabs in group:', error);
    return false;
  }
}

// 对标签组进行排序
async function sortTabGroups(windowId = chrome.windows.WINDOW_ID_CURRENT) {
  console.log('开始对标签组进行排序, windowId:', windowId);
  try {
    // 获取窗口中的所有标签组
    const groups = await chrome.tabGroups.query({ windowId });
    console.log('窗口中的标签组:', groups);

    if (!groups || groups.length <= 1) {
      console.log('标签组数量不足，无需排序');
      return true; // 只有一个组不需要排序
    }

    // 根据标题对标签组进行排序
    let sortedGroups = [...groups];
    sortedGroups.sort((a, b) => {
      const titleA = a.title || '';
      const titleB = b.title || '';

      return settings.groupSortAscending ?
        titleA.localeCompare(titleB) :
        titleB.localeCompare(titleA);
    });

    console.log('排序后的标签组:', sortedGroups);

    // 移动标签组
    // 我们需要计算每个组的新位置，然后移动其中的标签页
    const newPositions = {};
    let currentIndex = 0;

    // 首先，按照排序后的顺序计算每个组的新起始位置
    for (const group of sortedGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      newPositions[group.id] = currentIndex;
      currentIndex += tabs.length;
    }

    // 然后，从后向前移动标签页，以避免位置冲突
    for (let i = sortedGroups.length - 1; i >= 0; i--) {
      const group = sortedGroups[i];
      const tabs = await chrome.tabs.query({ groupId: group.id });

      if (tabs.length > 0) {
        // 获取组内所有标签的ID
        const tabIds = tabs.map(tab => tab.id);

        // 移动到新位置
        await chrome.tabs.move(tabIds, { index: newPositions[group.id] });
      }
    }

    return true;
  } catch (error) {
    console.error('Error sorting tab groups:', error);
    return false;
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('收到消息:', message);

  // 测试消息处理
  if (message.action === 'test') {
    console.log('收到测试消息:', message.data);
    sendResponse({ success: true, message: 'Background script received your message: ' + message.data });
    return true;
  }

  // 检查 service worker 状态
  if (message.action === 'checkServiceWorker') {
    console.log('收到检查 service worker 状态消息');
    sendResponse({
      success: true,
      message: 'Service worker is active',
      timestamp: Date.now()
    });
    return true;
  }

  // 按域名分组标签页
  if (message.action === 'groupByDomain') {
    console.log('处理 groupByDomain 消息');
    groupTabsByDomain().then(success => {
      console.log('groupByDomain 执行结果:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('Error in groupByDomain:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 取消所有标签页分组
  if (message.action === 'ungroupAll') {
    console.log('处理 ungroupAll 消息');
    ungroupAllTabs().then(success => {
      console.log('ungroupAll 执行结果:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('Error in ungroupAll:', error);
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

  // 对组内标签页排序
  if (message.action === 'sortTabGroup') {
    console.log('处理 sortTabGroup 消息, groupId:', message.groupId);
    if (!message.groupId) {
      console.error('Missing groupId parameter');
      sendResponse({ success: false, error: 'Missing groupId parameter' });
      return true;
    }

    sortTabsInGroup(message.groupId).then(success => {
      console.log('sortTabGroup 执行结果:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('Error in sortTabGroup:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 获取排序指标
  if (message.action === 'getSortingMetrics') {
    console.log('处理 getSortingMetrics 消息');
    try {
      // 获取当前窗口的所有标签组
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (groups) => {
        console.log('查询到的标签组:', groups);

        // 如果没有标签组，返回空对象
        if (!groups || groups.length === 0) {
          console.log('没有标签组，返回空指标');
          sendResponse({
            success: true,
            metrics: {},
            sortingMethod: settings.groupSortingMethod,
            sortAscending: settings.groupSortAscending
          });
          return;
        }

        // 为每个组创建基本指标数据
        const metrics = {};

        for (const group of groups) {
          metrics[group.id] = {
            title: group.title || 'Unnamed Group',
            color: group.color,
            sortValue: group.title || 'Unnamed Group'
          };
        }

        console.log('返回排序指标:', metrics);
        sendResponse({
          success: true,
          metrics: metrics,
          sortingMethod: settings.groupSortingMethod,
          sortAscending: settings.groupSortAscending
        });
      });
      return true;
    } catch (error) {
      console.error('Error getting sorting metrics:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  // 未知消息
  console.warn('收到未知消息:', message);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// 输出初始化完成消息
console.log('Edge Tab Organizer - 简化版 Background Service Worker 初始化完成');
