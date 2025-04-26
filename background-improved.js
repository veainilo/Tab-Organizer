// 改进版 background.js
console.log('Edge Tab Organizer - 改进版 Background Service Worker 已启动');

// Helper function to get localized message
function getMessage(messageName, substitutions) {
  return chrome.i18n.getMessage(messageName, substitutions);
}

// 常量定义
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;
const TAB_GROUP_ID_NONE = -1;

// 标志，指示是否是用户手动取消分组
let manualUngrouping = false;

// 基本设置
let settings = {
  extensionActive: true,      // 插件激活开关
  autoGroupByDomain: true,
  autoGroupOnCreation: true,
  groupByRootDomain: true,
  ignoreTLD: true,
  useDynamicColors: true,
  enableTabSorting: true,
  sortingMethod: 'domain',
  sortAscending: true,
  enableGroupSorting: true,
  groupSortingMethod: 'smart', // 智能排序
  groupSortAscending: true,
  sortOnGroupCreated: true,
  sortOnGroupUpdated: true,
  sortOnTabGroupChanged: true,
  sortOnTabMoved: false,
  excludeDomains: [],
  colorScheme: {
    'default': 'blue'
  }
};

// 可用的标签组颜色
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// 用于智能分配的颜色序列 - 按照视觉差异排序
const colorSequence = [
  'red', 'blue', 'green', 'purple', 'yellow',
  'cyan', 'orange', 'pink', 'grey'
];

// 域名到颜色的映射缓存
const domainColorCache = {};

// 标签组创建时间记录
const groupCreateTimes = {};
// 标签组最后访问时间记录
const groupLastAccessTimes = {};

// Load settings when extension starts
chrome.storage.sync.get('tabOrganizerSettings', (data) => {
  console.log('Loading settings from storage:', data);
  if (data.tabOrganizerSettings) {
    settings = data.tabOrganizerSettings;
    console.log('Settings loaded:', settings);
  } else {
    console.log('No settings found, using defaults:', settings);
  }
});

// Listen for changes to settings
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.tabOrganizerSettings) {
    settings = changes.tabOrganizerSettings.newValue;
  }
});

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

// Extract root domain from hostname
function extractRootDomain(hostname) {
  try {
    // 处理 IP 地址
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }

    // 分割域名部分
    const parts = hostname.split('.');

    // 如果只有一部分，直接返回
    if (parts.length === 1) {
      return hostname;
    }

    // 处理常见的二级域名，如 co.uk, com.cn 等
    const commonSecondLevelDomains = ['co', 'com', 'org', 'net', 'edu', 'gov', 'mil'];

    // 如果是三部分或更多，并且倒数第二部分是常见二级域名，并且最后一部分是国家代码
    if (parts.length >= 3 &&
        commonSecondLevelDomains.includes(parts[parts.length - 2]) &&
        parts[parts.length - 1].length <= 3) {
      // 返回倒数第三部分，例如 example.co.uk 返回 example
      return parts[parts.length - 3];
    }

    // 对于普通域名，返回倒数第二部分，例如 example.com 返回 example
    return parts[parts.length - 2];
  } catch (e) {
    console.error('Error extracting root domain:', e);
    return hostname; // 出错时返回原始域名
  }
}

// Get domain for grouping based on settings
function getDomainForGrouping(url) {
  const fullDomain = extractDomain(url);
  if (!fullDomain) return '';

  // 如果同时启用了按根域名分组和忽略顶级域名
  if (settings.groupByRootDomain && settings.ignoreTLD) {
    return extractRootDomain(fullDomain);
  }
  // 如果只启用了按根域名分组
  else if (settings.groupByRootDomain) {
    // 分割域名部分
    const parts = fullDomain.split('.');

    // 处理常见的二级域名，如 co.uk, com.cn 等
    const commonSecondLevelDomains = ['co', 'com', 'org', 'net', 'edu', 'gov', 'mil'];

    if (parts.length > 2 &&
        commonSecondLevelDomains.includes(parts[parts.length - 2]) &&
        parts[parts.length - 1].length <= 3) {
      // 对于 example.co.uk 这样的情况，返回 example.co.uk
      if (parts.length === 3) {
        return fullDomain;
      }
      // 对于 sub.example.co.uk 这样的情况，返回 example.co.uk
      return parts.slice(-3).join('.');
    }

    // 对于普通域名，返回最后两部分，如 example.com
    if (parts.length > 1) {
      return parts.slice(-2).join('.');
    }

    return fullDomain;
  }
  // 如果都没启用，返回完整域名
  else {
    return fullDomain;
  }
}

// 为域名获取颜色
function getColorForDomain(domain) {
  // 如果已经有缓存的颜色，直接返回
  if (domainColorCache[domain]) {
    return domainColorCache[domain];
  }

  // 如果用户在设置中指定了颜色，使用用户设置
  if (settings.colorScheme[domain]) {
    domainColorCache[domain] = settings.colorScheme[domain];
    return domainColorCache[domain];
  }

  // 简化版：使用域名的哈希值来确定颜色
  const hash = domain.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  const color = baseColors[hash % baseColors.length];
  domainColorCache[domain] = color;
  return color;
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

      // 不再跳过单个标签页，所有标签页都分组

      // Check if any of these tabs are already in a group with the same domain
      let existingGroupId = null;

      for (const tabId of tabIds) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          try {
            const group = await chrome.tabGroups.get(tab.groupId);
            console.log('标签页已在组中:', tab, '组:', group);
            if (group.title === domain) {
              existingGroupId = tab.groupId;
              console.log('找到现有组:', existingGroupId);
              break;
            }
          } catch (error) {
            console.error('获取标签组信息失败:', error);
          }
        }
      }

      // 创建或更新标签组
      console.log('创建或更新标签组:', domain, '使用现有组ID:', existingGroupId);
      await createOrUpdateTabGroup(tabIds, domain, existingGroupId);
    }

    return true;
  } catch (error) {
    console.error('Error grouping tabs by domain:', error);
    return false;
  }
}

// 创建或更新标签组，并应用排序
async function createOrUpdateTabGroup(tabIds, domain, existingGroupId = null) {
  console.log('创建或更新标签组 - 标签IDs:', tabIds, '标题:', domain, '现有组ID:', existingGroupId);
  try {
    let groupId;

    if (existingGroupId) {
      // 添加到现有组
      console.log('添加标签到现有组:', tabIds, '-> 组ID:', existingGroupId);
      await chrome.tabs.group({ tabIds, groupId: existingGroupId });
      groupId = existingGroupId;
      console.log('标签已添加到现有组');
    } else {
      // 创建新组
      console.log('创建新标签组，标签IDs:', tabIds);
      groupId = await chrome.tabs.group({ tabIds });
      console.log('新组创建成功，ID:', groupId);

      // 记录组创建时间
      groupCreateTimes[groupId] = Date.now();

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      console.log('为域名设置颜色:', domain, '-> 颜色:', color);
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: color
      });
      console.log('组标题和颜色已设置');
    }

    // 更新组的最后访问时间
    groupLastAccessTimes[groupId] = Date.now();

    // 如果启用了标签排序，对组内标签进行排序
    if (settings.enableTabSorting) {
      console.log('对组内标签进行排序, 组ID:', groupId);
      await sortTabsInGroup(groupId);
    }

    console.log('标签组创建/更新成功, ID:', groupId);
    return groupId;
  } catch (error) {
    console.error('Error creating or updating tab group:', error);
    return null;
  }
}

// 取消所有标签页分组
async function ungroupAllTabs() {
  console.log('开始取消所有标签页分组');

  // 如果插件处于激活状态，不允许取消分组
  if (settings.extensionActive) {
    console.log('插件处于激活状态，不允许取消分组');
    return { success: false, error: 'Extension is active, ungrouping is not allowed' };
  }

  try {
    // 设置标志，指示这是用户手动取消分组
    manualUngrouping = true;

    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs);

    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        console.log('取消分组标签页:', tab);
        await chrome.tabs.ungroup(tab.id);
      }
    }

    // 延迟重置标志，给取消分组操作留出时间
    setTimeout(() => {
      manualUngrouping = false;
      console.log('重置手动取消分组标志');
    }, 1000);

    return { success: true };
  } catch (error) {
    console.error('Error ungrouping all tabs:', error);
    // 出错时也要重置标志
    manualUngrouping = false;
    return { success: false, error: error.message };
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

    // 根据设置的排序方法对标签进行排序
    let sortedTabs = [...tabs];

    switch (settings.sortingMethod) {
      case 'domain':
        sortedTabs.sort((a, b) => {
          const domainA = getDomainForGrouping(a.url || '');
          const domainB = getDomainForGrouping(b.url || '');

          return settings.sortAscending ?
            domainA.localeCompare(domainB) :
            domainB.localeCompare(domainA);
        });
        break;

      case 'title':
        sortedTabs.sort((a, b) => {
          const titleA = a.title || '';
          const titleB = b.title || '';

          return settings.sortAscending ?
            titleA.localeCompare(titleB) :
            titleB.localeCompare(titleA);
        });
        break;

      case 'url':
        sortedTabs.sort((a, b) => {
          const urlA = a.url || '';
          const urlB = b.url || '';

          return settings.sortAscending ?
            urlA.localeCompare(urlB) :
            urlB.localeCompare(urlA);
        });
        break;

      case 'createTime':
        // 这里简化处理，实际应该使用真实的创建时间
        sortedTabs.sort((a, b) => {
          return settings.sortAscending ? a.id - b.id : b.id - a.id;
        });
        break;

      default:
        // 默认按域名排序
        sortedTabs.sort((a, b) => {
          const domainA = getDomainForGrouping(a.url || '');
          const domainB = getDomainForGrouping(b.url || '');

          return settings.sortAscending ?
            domainA.localeCompare(domainB) :
            domainB.localeCompare(domainA);
        });
    }

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
    // 如果没有启用标签组排序，直接返回
    if (!settings.enableGroupSorting) {
      console.log('标签组排序未启用，退出');
      return true;
    }

    // 获取窗口中的所有标签组
    const groups = await chrome.tabGroups.query({ windowId });
    console.log('窗口中的标签组:', groups);

    if (!groups || groups.length <= 1) {
      console.log('标签组数量不足，无需排序');
      return true; // 只有一个组不需要排序
    }

    // 根据智能排序对标签组进行排序
    let sortedGroups = [...groups];
    const groupScores = {};

    for (const group of sortedGroups) {
      // 获取组内标签页数量
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const size = tabs.length;

      // 获取组的创建时间和最后访问时间
      const createTime = groupCreateTimes[group.id] || Date.now();
      const accessTime = groupLastAccessTimes[group.id] || Date.now();

      // 计算智能排序的各项分数
      const accessScore = 1 - Math.min((Date.now() - accessTime) / 86400000, 1); // 最近访问得高分
      const sizeScore = Math.min(size / 10, 1); // 最多10个标签页得满分
      const createScore = 1 - Math.min((Date.now() - createTime) / 604800000, 1); // 最近创建得高分

      // 计算最终分数（加权平均）
      const accessWeight = 0.5;
      const sizeWeight = 0.3;
      const createWeight = 0.2;
      const finalScore = (
        accessScore * accessWeight +
        sizeScore * sizeWeight +
        createScore * createWeight
      );

      groupScores[group.id] = finalScore;
    }

    // 根据排序方法对组进行排序
    switch (settings.groupSortingMethod) {
      case 'title':
        sortedGroups.sort((a, b) => {
          const titleA = a.title || '';
          const titleB = b.title || '';

          return settings.groupSortAscending ?
            titleA.localeCompare(titleB) :
            titleB.localeCompare(titleA);
        });
        break;

      case 'color':
        sortedGroups.sort((a, b) => {
          const colorA = a.color || '';
          const colorB = b.color || '';

          return settings.groupSortAscending ?
            colorA.localeCompare(colorB) :
            colorB.localeCompare(colorA);
        });
        break;

      case 'size':
        sortedGroups.sort(async (a, b) => {
          const tabsA = await chrome.tabs.query({ groupId: a.id });
          const tabsB = await chrome.tabs.query({ groupId: b.id });

          return settings.groupSortAscending ?
            tabsA.length - tabsB.length :
            tabsB.length - tabsA.length;
        });
        break;

      case 'createTime':
        sortedGroups.sort((a, b) => {
          const timeA = groupCreateTimes[a.id] || 0;
          const timeB = groupCreateTimes[b.id] || 0;

          return settings.groupSortAscending ?
            timeA - timeB :
            timeB - timeA;
        });
        break;

      case 'lastAccessed':
        sortedGroups.sort((a, b) => {
          const timeA = groupLastAccessTimes[a.id] || 0;
          const timeB = groupLastAccessTimes[b.id] || 0;

          return settings.groupSortAscending ?
            timeA - timeB :
            timeB - timeA;
        });
        break;

      case 'smart':
        // 使用智能排序分数
        sortedGroups.sort((a, b) => {
          const scoreA = groupScores[a.id] || 0;
          const scoreB = groupScores[b.id] || 0;

          return settings.groupSortAscending ?
            scoreA - scoreB :
            scoreB - scoreA;
        });
        break;

      default:
        // 默认按标题排序
        sortedGroups.sort((a, b) => {
          const titleA = a.title || '';
          const titleB = b.title || '';

          return settings.groupSortAscending ?
            titleA.localeCompare(titleB) :
            titleB.localeCompare(titleA);
        });
    }

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

// 获取排序指标数据
async function getSortingMetrics() {
  try {
    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });

    // 如果没有标签组，返回空对象
    if (!groups || groups.length === 0) {
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

      // 获取组的创建时间和最后访问时间
      const createTime = groupCreateTimes[group.id] || now;
      const accessTime = groupLastAccessTimes[group.id] || now;

      // 计算智能排序的各项分数
      const accessScore = 1 - Math.min((now - accessTime) / 86400000, 1); // 最近访问得高分
      const sizeScore = Math.min(size / 10, 1); // 最多10个标签页得满分
      const createScore = 1 - Math.min((now - createTime) / 604800000, 1); // 最近创建得高分

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
    ungroupAllTabs().then(response => {
      console.log('ungroupAll 执行结果:', response);
      sendResponse(response);
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
    getSortingMetrics().then(response => {
      console.log('getSortingMetrics 执行结果:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Error in getSortingMetrics:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 切换插件激活状态
  if (message.action === 'toggleExtensionActive') {
    console.log('处理 toggleExtensionActive 消息');
    const newState = message.active !== undefined ? message.active : !settings.extensionActive;
    settings.extensionActive = newState;

    // 保存设置
    chrome.storage.sync.set({ tabOrganizerSettings: settings }, () => {
      console.log('设置已保存:', settings);
    });

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

  // 未知消息
  console.warn('收到未知消息:', message);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// 监听标签页创建事件
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('标签页创建:', tab);

  // 如果没有启用自动分组或者是用户手动取消分组，直接返回
  if (!settings.autoGroupOnCreation || manualUngrouping) {
    console.log('自动分组未启用或者是手动取消分组，退出. 手动取消分组:', manualUngrouping);
    return;
  }

  // 如果标签页没有URL，直接返回
  if (!tab.url) {
    console.log('标签页没有URL，退出');
    return;
  }

  try {
    // 获取域名
    const domain = getDomainForGrouping(tab.url);
    if (!domain || settings.excludeDomains.includes(domain)) {
      console.log('域名为空或被排除:', domain);
      return;
    }

    // 查找是否有匹配的组
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
    let matchingGroupId = null;

    for (const group of groups) {
      if (group.title === domain) {
        matchingGroupId = group.id;
        break;
      }
    }

    // 如果找到匹配的组，将标签页添加到该组
    if (matchingGroupId) {
      console.log('找到匹配的组，添加标签页:', matchingGroupId);
      await chrome.tabs.group({ tabIds: [tab.id], groupId: matchingGroupId });

      // 更新组的最后访问时间
      groupLastAccessTimes[matchingGroupId] = Date.now();

      // 如果启用了标签排序，对组内标签进行排序
      if (settings.enableTabSorting && settings.sortOnTabGroupChanged) {
        await sortTabsInGroup(matchingGroupId);
      }
    } else {
      // 如果没有匹配的组，创建新组
      console.log('没有匹配的组，创建新组');
      const newGroupId = await chrome.tabs.group({ tabIds: [tab.id] });

      // 记录组创建时间
      groupCreateTimes[newGroupId] = Date.now();

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      await chrome.tabGroups.update(newGroupId, {
        title: domain,
        color: color
      });

      // 更新组的最后访问时间
      groupLastAccessTimes[newGroupId] = Date.now();
    }
  } catch (error) {
    console.error('处理新标签页时出错:', error);
  }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('标签页更新:', tabId, changeInfo, tab);

  // 只有当URL变化时且不是用户手动取消分组时才处理
  if (changeInfo.url && settings.autoGroupByDomain && !manualUngrouping) {
    console.log('标签页URL变化:', changeInfo.url, '手动取消分组:', manualUngrouping);

    try {
      // 获取标签页当前所在的组
      const currentGroupId = tab.groupId;

      // 如果标签页不在任何组中，或者在一个组中但组标题与域名不匹配，则重新分组
      if (currentGroupId === TAB_GROUP_ID_NONE) {
        console.log('标签页不在任何组中，尝试分组');

        // 获取域名
        const domain = getDomainForGrouping(changeInfo.url);
        if (!domain || settings.excludeDomains.includes(domain)) {
          console.log('域名为空或被排除:', domain);
          return;
        }

        // 查找是否有匹配的组
        const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
        let matchingGroupId = null;

        for (const group of groups) {
          if (group.title === domain) {
            matchingGroupId = group.id;
            break;
          }
        }

        // 如果找到匹配的组，将标签页添加到该组
        if (matchingGroupId) {
          console.log('找到匹配的组，添加标签页:', matchingGroupId);
          await chrome.tabs.group({ tabIds: [tabId], groupId: matchingGroupId });

          // 更新组的最后访问时间
          groupLastAccessTimes[matchingGroupId] = Date.now();

          // 如果启用了标签排序，对组内标签进行排序
          if (settings.enableTabSorting && settings.sortOnTabGroupChanged) {
            await sortTabsInGroup(matchingGroupId);
          }
        } else {
          // 如果没有匹配的组，创建新组
          console.log('没有匹配的组，创建新组');
          const newGroupId = await chrome.tabs.group({ tabIds: [tabId] });

          // 记录组创建时间
          groupCreateTimes[newGroupId] = Date.now();

          // 设置组标题和颜色
          const color = getColorForDomain(domain);
          await chrome.tabGroups.update(newGroupId, {
            title: domain,
            color: color
          });

          // 更新组的最后访问时间
          groupLastAccessTimes[newGroupId] = Date.now();
        }
      } else {
        // 标签页已在组中，检查组标题是否与域名匹配
        try {
          const group = await chrome.tabGroups.get(currentGroupId);
          const domain = getDomainForGrouping(changeInfo.url);

          if (group.title !== domain && !settings.excludeDomains.includes(domain)) {
            console.log('标签页所在组与域名不匹配，移动标签页');

            // 先将标签页从当前组中移除
            await chrome.tabs.ungroup(tabId);

            // 查找是否有匹配的组
            const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
            let matchingGroupId = null;

            for (const g of groups) {
              if (g.title === domain) {
                matchingGroupId = g.id;
                break;
              }
            }

            // 如果找到匹配的组，将标签页添加到该组
            if (matchingGroupId) {
              console.log('找到匹配的组，添加标签页:', matchingGroupId);
              await chrome.tabs.group({ tabIds: [tabId], groupId: matchingGroupId });

              // 更新组的最后访问时间
              groupLastAccessTimes[matchingGroupId] = Date.now();

              // 如果启用了标签排序，对组内标签进行排序
              if (settings.enableTabSorting && settings.sortOnTabGroupChanged) {
                await sortTabsInGroup(matchingGroupId);
              }
            } else {
              // 如果没有匹配的组，创建新组
              console.log('没有匹配的组，创建新组');
              const newGroupId = await chrome.tabs.group({ tabIds: [tabId] });

              // 记录组创建时间
              groupCreateTimes[newGroupId] = Date.now();

              // 设置组标题和颜色
              const color = getColorForDomain(domain);
              await chrome.tabGroups.update(newGroupId, {
                title: domain,
                color: color
              });

              // 更新组的最后访问时间
              groupLastAccessTimes[newGroupId] = Date.now();
            }
          }
        } catch (error) {
          console.error('获取标签组信息失败:', error);
        }
      }
    } catch (error) {
      console.error('处理标签页更新时出错:', error);
    }
  }
});

// 监听标签页移动事件
chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  console.log('标签页移动:', tabId, moveInfo);

  // 如果启用了标签排序和标签移动时排序
  if (settings.enableTabSorting && settings.sortOnTabMoved) {
    // 获取标签页信息
    chrome.tabs.get(tabId, (tab) => {
      // 如果标签页在组中，对组内标签进行排序
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        sortTabsInGroup(tab.groupId);
      }
    });
  }
});

// 监听标签组更新事件
chrome.tabGroups.onUpdated.addListener((group) => {
  console.log('标签组更新:', group);

  // 更新组的最后访问时间
  groupLastAccessTimes[group.id] = Date.now();

  // 如果启用了标签排序和组更新时排序
  if (settings.enableTabSorting && settings.sortOnGroupUpdated) {
    sortTabsInGroup(group.id);
  }
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('标签页激活:', activeInfo);

  // 获取标签页信息
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    // 如果标签页在组中，更新组的最后访问时间
    if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
      groupLastAccessTimes[tab.groupId] = Date.now();
    }
  });
});

// 监听标签组变化事件
chrome.tabGroups.onChanged.addListener((tabGroup) => {
  console.log('标签组变化:', tabGroup);

  // 更新组的最后访问时间
  groupLastAccessTimes[tabGroup.id] = Date.now();
});

// 监听标签页从组中移除事件
chrome.tabs.onGroupChanged.addListener(async (tabId, { groupId, previousGroupId }) => {
  console.log('标签页组变化:', tabId, groupId, previousGroupId);

  // 如果标签页从组中移除（groupId 为 -1）且不是用户手动取消分组
  if (groupId === TAB_GROUP_ID_NONE && settings.autoGroupByDomain && !manualUngrouping) {
    console.log('标签页从组中移除:', tabId, '手动取消分组:', manualUngrouping);

    try {
      // 获取标签页信息
      const tab = await chrome.tabs.get(tabId);

      // 如果标签页有URL，尝试重新分组
      if (tab.url) {
        // 获取域名
        const domain = getDomainForGrouping(tab.url);
        if (!domain || settings.excludeDomains.includes(domain)) {
          console.log('域名为空或被排除:', domain);
          return;
        }

        // 查找是否有匹配的组
        const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
        let matchingGroupId = null;

        for (const group of groups) {
          if (group.title === domain) {
            matchingGroupId = group.id;
            break;
          }
        }

        // 如果找到匹配的组，将标签页添加到该组
        if (matchingGroupId) {
          console.log('找到匹配的组，添加标签页:', matchingGroupId);
          await chrome.tabs.group({ tabIds: [tabId], groupId: matchingGroupId });

          // 更新组的最后访问时间
          groupLastAccessTimes[matchingGroupId] = Date.now();

          // 如果启用了标签排序，对组内标签进行排序
          if (settings.enableTabSorting && settings.sortOnTabGroupChanged) {
            await sortTabsInGroup(matchingGroupId);
          }
        } else {
          // 如果没有匹配的组，创建新组
          console.log('没有匹配的组，创建新组');
          const newGroupId = await chrome.tabs.group({ tabIds: [tabId] });

          // 记录组创建时间
          groupCreateTimes[newGroupId] = Date.now();

          // 设置组标题和颜色
          const color = getColorForDomain(domain);
          await chrome.tabGroups.update(newGroupId, {
            title: domain,
            color: color
          });

          // 更新组的最后访问时间
          groupLastAccessTimes[newGroupId] = Date.now();
        }
      }
    } catch (error) {
      console.error('处理标签页从组中移除时出错:', error);
    }
  }
  // 如果标签页添加到组中，更新组的最后访问时间
  else if (groupId !== TAB_GROUP_ID_NONE) {
    groupLastAccessTimes[groupId] = Date.now();

    // 如果启用了标签排序和组变化时排序
    if (settings.enableTabSorting && settings.sortOnTabGroupChanged) {
      await sortTabsInGroup(groupId);
    }
  }
});

// 输出初始化完成消息
console.log('Edge Tab Organizer - 改进版 Background Service Worker 初始化完成');
