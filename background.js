// 初始化 service worker
console.log('Edge Tab Organizer - Background Service Worker 已启动');

// 常量定义
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;
const TAB_GROUP_ID_NONE = -1;

// 标志，指示是否是用户手动取消分组
let manualUngrouping = false;

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
// Edge 浏览器支持的标签组颜色名称
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// 用于智能分配的颜色序列 - 按照视觉差异排序
const colorSequence = [
  'red', 'blue', 'green', 'purple', 'yellow',
  'cyan', 'orange', 'pink', 'grey'
];

// 颜色的视觉特性映射 - 用于计算颜色差异
// 这些值代表每种颜色在色调、饱和度、亮度空间中的近似位置
const colorProperties = {
  'red':    { hue: 0,   saturation: 1.0, brightness: 0.7 },
  'orange': { hue: 30,  saturation: 1.0, brightness: 0.8 },
  'yellow': { hue: 60,  saturation: 1.0, brightness: 0.9 },
  'green':  { hue: 120, saturation: 0.8, brightness: 0.6 },
  'cyan':   { hue: 180, saturation: 0.7, brightness: 0.7 },
  'blue':   { hue: 240, saturation: 1.0, brightness: 0.7 },
  'purple': { hue: 270, saturation: 0.8, brightness: 0.6 },
  'pink':   { hue: 330, saturation: 0.7, brightness: 0.8 },
  'grey':   { hue: 0,   saturation: 0.0, brightness: 0.5 }
};

// 域名到颜色的映射缓存
const domainColorCache = {};

// 已分配的颜色计数
const colorUsageCount = {};
// 初始化颜色使用计数
baseColors.forEach(color => colorUsageCount[color] = 0);

// 当前已分配的域名列表
const assignedDomains = [];

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

// 标签页访问时间记录
const tabAccessTimes = {};
// 标签页创建时间记录
const tabCreateTimes = {};
// 标签页使用频率记录
const tabUsageCount = {};

// 标签组创建时间记录
const groupCreateTimes = {};
// 标签组最后访问时间记录
const groupLastAccessTimes = {};
// 标签组排序指标数据
const groupSortingMetrics = {};

// 按域名分组标签页
async function groupTabsByDomain() {
  console.log('开始按域名分组标签页');

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
      if (!domain || settings.excludeDomains.includes(domain)) continue;

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

// Handle tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('Tab created:', tab);
  console.log('autoGroupOnCreation setting:', settings.autoGroupOnCreation);

  // 如果扩展未激活或自动分组未启用，不执行任何操作
  if (!settings.extensionActive || !settings.autoGroupOnCreation) {
    console.log('扩展未激活或自动分组未启用，退出. 扩展激活状态:', settings.extensionActive);
    return;
  }

  // 如果是用户手动取消分组，不执行自动分组
  if (manualUngrouping) {
    console.log('用户手动取消分组，不执行自动分组');
    return;
  }

  // Wait a moment for the tab to load
  setTimeout(async () => {
    try {
      // Get updated tab info
      const updatedTab = await chrome.tabs.get(tab.id);
      console.log('Updated tab info:', updatedTab);

      if (!updatedTab.url) {
        console.log('Tab has no URL, skipping');
        return;
      }

      const domain = getDomainForGrouping(updatedTab.url);
      console.log('Domain for grouping:', domain);

      if (!domain || settings.excludeDomains.includes(domain)) {
        console.log('Domain is empty or excluded, skipping');
        return;
      }

      // 创建新组
      const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      console.log('新组创建成功，ID:', groupId);

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: color
      });
      console.log('组标题和颜色已设置');
    } catch (error) {
      console.error('Error handling new tab:', error);
    }
  }, 1000); // Wait 1 second for the tab to load
});

// Handle tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 如果扩展未激活或自动分组未启用，不执行任何操作
  if (!settings.extensionActive || !settings.autoGroupByDomain) return;
  if (!changeInfo.url) return;

  // 如果是用户手动取消分组，不执行自动分组
  if (manualUngrouping) return;

  // Wait a moment for the tab to fully update
  setTimeout(async () => {
    try {
      const domain = getDomainForGrouping(tab.url);
      if (!domain || settings.excludeDomains.includes(domain)) {
        // If tab is in a group, remove it
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          await chrome.tabs.ungroup(tabId);
        }
        return;
      }

      // If tab is in a group, remove it
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tabId);
      }

      // 创建新组
      const groupId = await chrome.tabs.group({ tabIds: [tabId] });
      console.log('新组创建成功，ID:', groupId);

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: color
      });
      console.log('组标题和颜色已设置');
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }, 500); // Wait 0.5 seconds for the tab to fully update
});

// 对标签组内的标签进行排序
async function sortTabsInGroup(groupId) {
  console.log('开始对标签组内的标签进行排序, groupId:', groupId);
  try {
    // 获取组内所有标签
    const tabs = await chrome.tabs.query({ groupId });
    console.log('组内标签页:', tabs);

    if (!tabs || tabs.length <= 1) {
      console.log('标签页数量不足，无需排序');
      return; // 只有一个标签不需要排序
    }

    // 根据设置的排序方法对标签进行排序
    let sortedTabs = [...tabs];
    console.log('排序方法:', settings.sortingMethod, '升序:', settings.sortAscending);

    switch (settings.sortingMethod) {
      case 'domain':
        // 按域名排序
        sortedTabs.sort((a, b) => {
          const domainA = extractDomain(a.url || '');
          const domainB = extractDomain(b.url || '');
          return settings.sortAscending ?
            domainA.localeCompare(domainB) :
            domainB.localeCompare(domainA);
        });
        break;

      case 'title':
        // 按标题排序
        sortedTabs.sort((a, b) => {
          return settings.sortAscending ?
            a.title.localeCompare(b.title) :
            b.title.localeCompare(a.title);
        });
        break;

      case 'accessTime':
        // 按最近访问时间排序
        sortedTabs.sort((a, b) => {
          const timeA = tabAccessTimes[a.id] || 0;
          const timeB = tabAccessTimes[b.id] || 0;
          return settings.sortAscending ?
            timeA - timeB :
            timeB - timeA;
        });
        break;

      case 'createTime':
        // 按创建时间排序
        sortedTabs.sort((a, b) => {
          const timeA = tabCreateTimes[a.id] || 0;
          const timeB = tabCreateTimes[b.id] || 0;
          return settings.sortAscending ?
            timeA - timeB :
            timeB - timeA;
        });
        break;

      case 'frequency':
        // 按使用频率排序
        sortedTabs.sort((a, b) => {
          const countA = tabUsageCount[a.id] || 0;
          const countB = tabUsageCount[b.id] || 0;
          return settings.sortAscending ?
            countA - countB :
            countB - countA;
        });
        break;

      case 'smart':
        // 智能排序 (结合多种因素)
        sortedTabs.sort((a, b) => {
          // 计算综合分数 (访问时间、使用频率、创建时间的加权平均)
          const scoreA = calculateSmartScore(a.id);
          const scoreB = calculateSmartScore(b.id);
          return settings.sortAscending ?
            scoreA - scoreB :
            scoreB - scoreA;
        });
        break;
    }

    // 移动标签到新的位置
    for (let i = 0; i < sortedTabs.length; i++) {
      await chrome.tabs.move(sortedTabs[i].id, { index: i });
    }
  } catch (error) {
    console.error('Error sorting tabs in group:', error);
  }
}

// 计算标签的智能排序分数
function calculateSmartScore(tabId) {
  const now = Date.now();
  const accessTime = tabAccessTimes[tabId] || 0;
  const createTime = tabCreateTimes[tabId] || 0;
  const usageCount = tabUsageCount[tabId] || 0;

  // 访问时间权重 (最近访问的分数高)
  const accessScore = accessTime ? (now - accessTime) / 3600000 : 24; // 小时为单位，最大24

  // 使用频率权重
  const usageScore = Math.min(usageCount, 100); // 最大100

  // 创建时间权重 (新创建的分数高)
  const createScore = createTime ? (now - createTime) / 86400000 : 30; // 天为单位，最大30

  // 综合分数 (访问时间占50%，使用频率占30%，创建时间占20%)
  return (accessScore * 0.5) + (usageScore * 0.3) + (createScore * 0.2);
}

// 记录标签访问时间
chrome.tabs.onActivated.addListener(activeInfo => {
  tabAccessTimes[activeInfo.tabId] = Date.now();
  tabUsageCount[activeInfo.tabId] = (tabUsageCount[activeInfo.tabId] || 0) + 1;
});

// 记录标签创建时间
chrome.tabs.onCreated.addListener(tab => {
  tabCreateTimes[tab.id] = Date.now();
  tabAccessTimes[tab.id] = Date.now();
  tabUsageCount[tab.id] = 1;
});

// 清理已关闭标签的记录
chrome.tabs.onRemoved.addListener(tabId => {
  delete tabAccessTimes[tabId];
  delete tabCreateTimes[tabId];
  delete tabUsageCount[tabId];
});

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

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      console.log('为域名设置颜色:', domain, '-> 颜色:', color);
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: color
      });
      console.log('组标题和颜色已设置');
    }

    console.log('标签组创建/更新成功, ID:', groupId);
    return groupId;
  } catch (error) {
    console.error('Error creating or updating tab group:', error);
    return null;
  }
}

// 对窗口中的所有标签组进行排序
async function sortTabGroups(windowId = chrome.windows.WINDOW_ID_CURRENT) {
  console.log('开始对窗口中的所有标签组进行排序, windowId:', windowId);
  try {
    // 如果没有启用标签组排序，直接返回
    if (!settings.enableGroupSorting) {
      console.log('标签组排序未启用，退出');
      return;
    }

    // 获取窗口中的所有标签组
    const groups = await chrome.tabGroups.query({ windowId });
    console.log('窗口中的标签组:', groups);

    if (!groups || groups.length <= 1) {
      console.log('标签组数量不足，无需排序');
      return; // 只有一个组不需要排序
    }

    // 清除旧的排序指标数据
    groups.forEach(group => {
      if (groupSortingMetrics[group.id]) {
        delete groupSortingMetrics[group.id];
      }
    });
    console.log('排序方法:', settings.groupSortingMethod, '升序:', settings.groupSortAscending);

    // 获取每个组的第一个标签页的索引，用于确定组的位置
    const groupPositions = {};
    for (const group of groups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      if (tabs.length > 0) {
        groupPositions[group.id] = Math.min(...tabs.map(tab => tab.index));
      }
    }

    // 根据设置的排序方法对标签组进行排序
    let sortedGroups = [...groups];

    switch (settings.groupSortingMethod) {
      case 'title':
        // 按标题排序
        sortedGroups.sort((a, b) => {
          const titleA = a.title || '';
          const titleB = b.title || '';

          // 保存排序指标数据
          if (!groupSortingMetrics[a.id]) groupSortingMetrics[a.id] = {};
          if (!groupSortingMetrics[b.id]) groupSortingMetrics[b.id] = {};

          groupSortingMetrics[a.id].title = titleA;
          groupSortingMetrics[a.id].sortValue = titleA;
          groupSortingMetrics[b.id].title = titleB;
          groupSortingMetrics[b.id].sortValue = titleB;

          return settings.groupSortAscending ?
            titleA.localeCompare(titleB) :
            titleB.localeCompare(titleA);
        });
        break;

      case 'color':
        // 按颜色排序 (使用预定义的颜色顺序)
        const colorOrder = {
          'grey': 0, 'blue': 1, 'red': 2, 'yellow': 3,
          'green': 4, 'pink': 5, 'purple': 6, 'cyan': 7, 'orange': 8
        };

        sortedGroups.sort((a, b) => {
          const colorA = colorOrder[a.color] || 0;
          const colorB = colorOrder[b.color] || 0;

          // 保存排序指标数据
          if (!groupSortingMetrics[a.id]) groupSortingMetrics[a.id] = {};
          if (!groupSortingMetrics[b.id]) groupSortingMetrics[b.id] = {};

          groupSortingMetrics[a.id].color = a.color;
          groupSortingMetrics[a.id].colorOrder = colorA;
          groupSortingMetrics[a.id].sortValue = colorA;
          groupSortingMetrics[b.id].color = b.color;
          groupSortingMetrics[b.id].colorOrder = colorB;
          groupSortingMetrics[b.id].sortValue = colorB;

          return settings.groupSortAscending ?
            colorA - colorB :
            colorB - colorA;
        });
        break;

      case 'size':
        // 按标签页数量排序
        let groupSizes = {};
        for (const group of groups) {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          groupSizes[group.id] = tabs.length;

          // 初始化排序指标数据
          if (!groupSortingMetrics[group.id]) groupSortingMetrics[group.id] = {};
          groupSortingMetrics[group.id].size = tabs.length;
          groupSortingMetrics[group.id].sortValue = tabs.length;
        }

        sortedGroups.sort((a, b) => {
          const sizeA = groupSizes[a.id] || 0;
          const sizeB = groupSizes[b.id] || 0;
          return settings.groupSortAscending ?
            sizeA - sizeB :
            sizeB - sizeA;
        });
        break;

      case 'createTime':
        // 按创建时间排序
        sortedGroups.sort((a, b) => {
          const timeA = groupCreateTimes[a.id] || 0;
          const timeB = groupCreateTimes[b.id] || 0;

          // 保存排序指标数据
          if (!groupSortingMetrics[a.id]) groupSortingMetrics[a.id] = {};
          if (!groupSortingMetrics[b.id]) groupSortingMetrics[b.id] = {};

          const dateA = timeA ? new Date(timeA) : new Date(0);
          const dateB = timeB ? new Date(timeB) : new Date(0);

          groupSortingMetrics[a.id].createTime = timeA;
          groupSortingMetrics[a.id].createTimeFormatted = dateA.toLocaleString();
          groupSortingMetrics[a.id].sortValue = timeA;
          groupSortingMetrics[b.id].createTime = timeB;
          groupSortingMetrics[b.id].createTimeFormatted = dateB.toLocaleString();
          groupSortingMetrics[b.id].sortValue = timeB;

          return settings.groupSortAscending ?
            timeA - timeB :
            timeB - timeA;
        });
        break;

      case 'lastAccessed':
        // 按最后访问时间排序
        sortedGroups.sort((a, b) => {
          const timeA = groupLastAccessTimes[a.id] || 0;
          const timeB = groupLastAccessTimes[b.id] || 0;

          // 保存排序指标数据
          if (!groupSortingMetrics[a.id]) groupSortingMetrics[a.id] = {};
          if (!groupSortingMetrics[b.id]) groupSortingMetrics[b.id] = {};

          const dateA = timeA ? new Date(timeA) : new Date(0);
          const dateB = timeB ? new Date(timeB) : new Date(0);

          groupSortingMetrics[a.id].lastAccessTime = timeA;
          groupSortingMetrics[a.id].lastAccessTimeFormatted = dateA.toLocaleString();
          groupSortingMetrics[a.id].sortValue = timeA;
          groupSortingMetrics[b.id].lastAccessTime = timeB;
          groupSortingMetrics[b.id].lastAccessTimeFormatted = dateB.toLocaleString();
          groupSortingMetrics[b.id].sortValue = timeB;

          return settings.groupSortAscending ?
            timeA - timeB :
            timeB - timeA;
        });
        break;

      case 'smart':
        // 智能排序 (结合多种因素)
        // 获取每个组的标签页数量
        groupSizes = {};
        for (const group of groups) {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          groupSizes[group.id] = tabs.length;
        }

        sortedGroups.sort((a, b) => {
          // 计算综合分数 (访问时间、创建时间、标签页数量的加权平均)
          const scoreA = calculateGroupSmartScore(a.id, groupSizes[a.id] || 0);
          const scoreB = calculateGroupSmartScore(b.id, groupSizes[b.id] || 0);
          return settings.groupSortAscending ?
            scoreA - scoreB :
            scoreB - scoreA;
        });
        break;
    }

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
  } catch (error) {
    console.error('Error sorting tab groups:', error);
  }
}

// 计算标签组的智能排序分数
function calculateGroupSmartScore(groupId, groupSize) {
  const now = Date.now();
  const accessTime = groupLastAccessTimes[groupId] || 0;
  const createTime = groupCreateTimes[groupId] || 0;

  // 访问时间权重 (最近访问的分数高)
  const accessScore = accessTime ? (now - accessTime) / 3600000 : 24; // 小时为单位，最大24

  // 标签页数量权重 (数量多的分数高)
  const sizeScore = Math.min(groupSize * 5, 100); // 最大100

  // 创建时间权重 (新创建的分数高)
  const createScore = createTime ? (now - createTime) / 86400000 : 30; // 天为单位，最大30

  // 综合分数 (访问时间占40%，标签页数量占40%，创建时间占20%)
  const finalScore = (accessScore * 0.4) + (sizeScore * 0.4) + (createScore * 0.2);

  // 保存排序指标数据
  groupSortingMetrics[groupId] = {
    accessTime: accessTime,
    accessScore: accessScore,
    accessWeight: 0.4,

    size: groupSize,
    sizeScore: sizeScore,
    sizeWeight: 0.4,

    createTime: createTime,
    createScore: createScore,
    createWeight: 0.2,

    finalScore: finalScore
  };

  return finalScore;
}

// 监听标签组更新事件
chrome.tabGroups.onUpdated.addListener(async (group) => {
  // 如果扩展未激活，不执行任何操作
  if (!settings.extensionActive) return;

  // 更新标签组最后访问时间
  groupLastAccessTimes[group.id] = Date.now();

  // 如果启用了标签排序，对组内标签进行排序
  if (settings.enableTabSorting) {
    await sortTabsInGroup(group.id);
  }

  // 如果启用了标签组排序且设置了在更新时排序，对窗口中的标签组进行排序
  if (settings.enableGroupSorting && settings.sortOnGroupUpdated) {
    await sortTabGroups(group.windowId);
  }
});

// 监听标签组创建事件
chrome.tabGroups.onCreated.addListener(async (group) => {
  // 如果扩展未激活，不执行任何操作
  if (!settings.extensionActive) return;

  // 记录标签组创建时间
  groupCreateTimes[group.id] = Date.now();
  groupLastAccessTimes[group.id] = Date.now();

  // 如果启用了标签组排序且设置了在创建时排序，对窗口中的标签组进行排序
  if (settings.enableGroupSorting && settings.sortOnGroupCreated) {
    // 稍微延迟一下，确保标签组已完全创建
    setTimeout(async () => {
      await sortTabGroups(group.windowId);
    }, 100);
  }
});

// 监听标签页组状态变化事件
chrome.tabs.onGroupChanged.addListener(async (tabId, details) => {
  // 如果扩展未激活，不执行任何操作
  if (!settings.extensionActive) return;

  // 更新标签组最后访问时间
  if (details.groupId !== TAB_GROUP_ID_NONE) {
    groupLastAccessTimes[details.groupId] = Date.now();
  }

  // 如果启用了标签组排序且设置了在标签页组状态变化时排序，对窗口中的标签组进行排序
  if (settings.enableGroupSorting && settings.sortOnTabGroupChanged) {
    // 稍微延迟一下，确保标签组状态已更新
    setTimeout(async () => {
      const tab = await chrome.tabs.get(tabId);
      await sortTabGroups(tab.windowId);
    }, 100);
  }
});

// 监听标签页移动事件
chrome.tabs.onMoved.addListener(async (tabId, _moveInfo) => {
  // 如果扩展未激活，不执行任何操作
  if (!settings.extensionActive) return;

  // 获取标签页信息
  const tab = await chrome.tabs.get(tabId);

  // 如果标签页属于某个组，并且启用了标签组排序，且设置了在标签页移动时排序
  if (tab.groupId !== TAB_GROUP_ID_NONE && settings.enableGroupSorting && settings.sortOnTabMoved) {
    // 更新标签组最后访问时间
    groupLastAccessTimes[tab.groupId] = Date.now();

    // 稍微延迟一下，确保标签页移动已完成
    setTimeout(async () => {
      await sortTabGroups(tab.windowId);
    }, 200);
  }
});

// Listen for messages from popup or options page
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
      timestamp: Date.now(),
      settings: settings
    });
    return true;
  }

  if (message.action === 'groupByDomain') {
    console.log('处理 groupByDomain 消息');

    // 立即发送一个初始响应，表示消息已收到
    sendResponse({ success: true, status: 'processing' });

    // 然后异步执行分组操作
    groupTabsByDomain().then(() => {
      console.log('groupByDomain 成功完成');

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

    return true; // Indicates async response
  }

  if (message.action === 'ungroupAll') {
    console.log('处理 ungroupAll 消息');

    // 如果插件处于激活状态，不允许取消分组
    if (settings.extensionActive) {
      console.log('插件处于激活状态，不允许取消分组');
      sendResponse({ success: false, error: 'Extension is active, ungrouping is not allowed' });
      return true;
    }

    // 设置手动取消分组标志，防止自动重新分组
    manualUngrouping = true;

    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      console.log('查询到的标签页:', tabs);
      try {
        for (const tab of tabs) {
          if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
            console.log('取消分组标签页:', tab);
            await chrome.tabs.ungroup(tab.id);
          }
        }
        console.log('ungroupAll 成功完成');

        // 操作完成后重置标志
        setTimeout(() => {
          manualUngrouping = false;
          console.log('重置手动取消分组标志');
        }, 1000);

        sendResponse({ success: true });
      } catch (error) {
        console.error('Error in ungroupAll:', error);
        // 出错时也重置标志
        manualUngrouping = false;
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Indicates async response
  }

  if (message.action === 'sortTabGroup') {
    console.log('处理 sortTabGroup 消息, groupId:', message.groupId);
    sortTabsInGroup(message.groupId).then(() => {
      console.log('sortTabGroup 成功完成');
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error in sortTabGroup:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Indicates async response
  }

  if (message.action === 'sortTabGroups') {
    console.log('处理 sortTabGroups 消息');
    sortTabGroups().then(() => {
      console.log('sortTabGroups 成功完成');
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error in sortTabGroups:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Indicates async response
  }

  if (message.action === 'getSortingMetrics') {
    console.log('getSortingMetrics message received');
    try {
      // 获取当前窗口的所有标签组
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, async (groups) => {
        console.log('Tab groups found:', groups, 'Length:', groups.length);
        // 为每个组添加标题信息
        const metricsWithTitles = {};

        // 如果没有标签组，返回空对象
        if (!groups || groups.length === 0) {
          console.log('No tab groups found, returning empty metrics');
          sendResponse({
            success: true,
            metrics: metricsWithTitles,
            sortingMethod: settings.groupSortingMethod,
            sortAscending: settings.groupSortAscending
          });
          return;
        }

        // 为每个组创建基本指标数据
        for (const group of groups) {
          // 如果没有排序指标数据，创建基本数据
          if (!groupSortingMetrics[group.id]) {
            // 获取组内标签页数量
            const tabs = await chrome.tabs.query({ groupId: group.id });
            const groupSize = tabs.length;

            // 根据排序方法创建基本指标数据
            switch (settings.groupSortingMethod) {
              case 'title':
                groupSortingMetrics[group.id] = {
                  title: group.title || 'Unnamed Group',
                  sortValue: group.title || 'Unnamed Group'
                };
                break;

              case 'color':
                const colorOrder = {
                  'grey': 0, 'blue': 1, 'red': 2, 'yellow': 3,
                  'green': 4, 'pink': 5, 'purple': 6, 'cyan': 7, 'orange': 8
                };
                groupSortingMetrics[group.id] = {
                  color: group.color,
                  colorOrder: colorOrder[group.color] || 0,
                  sortValue: colorOrder[group.color] || 0
                };
                break;

              case 'size':
                groupSortingMetrics[group.id] = {
                  size: groupSize,
                  sortValue: groupSize
                };
                break;

              case 'createTime':
                const createTime = groupCreateTimes[group.id] || Date.now();
                const createDate = new Date(createTime);
                groupSortingMetrics[group.id] = {
                  createTime: createTime,
                  createTimeFormatted: createDate.toLocaleString(),
                  sortValue: createTime
                };
                break;

              case 'lastAccessed':
                const accessTime = groupLastAccessTimes[group.id] || Date.now();
                const accessDate = new Date(accessTime);
                groupSortingMetrics[group.id] = {
                  lastAccessTime: accessTime,
                  lastAccessTimeFormatted: accessDate.toLocaleString(),
                  sortValue: accessTime
                };
                break;

              case 'smart':
                // 为智能排序创建基本指标数据
                calculateGroupSmartScore(group.id, groupSize);
                break;
            }
          }

          // 添加到返回对象
          metricsWithTitles[group.id] = {
            ...groupSortingMetrics[group.id],
            title: group.title || 'Unnamed Group',
            color: group.color
          };
        }

        sendResponse({
          success: true,
          metrics: metricsWithTitles,
          sortingMethod: settings.groupSortingMethod,
          sortAscending: settings.groupSortAscending
        });
      });
      return true; // Indicates async response
    } catch (error) {
      console.error('Error getting sorting metrics:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
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
console.log('Edge Tab Organizer - Background Service Worker 初始化完成');
