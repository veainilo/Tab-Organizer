// 初始化 service worker
console.log('Edge Tab Organizer - Background Service Worker 已启动');

// 常量定义
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;
const TAB_GROUP_ID_NONE = -1;

// 标志，指示是否是用户手动取消分组
let manualUngrouping = false;

// 基本设置
let settings = {
  extensionActive: true,          // 默认激活状态
  autoGroupByDomain: true,        // 自动按域名分组
  autoGroupOnCreation: true,      // 创建标签时自动分组
  groupByRootDomain: true,        // 按根域名分组
  ignoreTLD: true,                // 忽略顶级域名
  useDynamicColors: true,         // 使用动态颜色
  enableTabSorting: true,         // 启用标签排序
  sortingMethod: 'domain',        // 标签排序方法
  sortAscending: true,            // 标签排序顺序（升序）
  enableGroupSorting: true,       // 启用标签组排序
  groupSortingMethod: 'smart',    // 标签组排序方法
  groupSortAscending: true,       // 标签组排序顺序（升序）
  excludeDomains: [],             // 排除的域名
  colorScheme: {                  // 颜色方案
    'default': 'blue'
  },
  // 监控设置
  continuousMonitoring: true,     // 持续监控标签状态
  autoGroupInterval: 5000,        // 自动监控间隔（毫秒）
  autoSortInterval: 10000,        // 自动排序间隔（毫秒）
  monitoringEnabled: true         // 是否启用监控
};

// 可用的标签组颜色
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// 保存设置到存储
function saveSettings() {
  console.log('保存设置到存储:', settings);
  chrome.storage.sync.set({ tabOrganizerSettings: settings }, () => {
    console.log('设置已保存');
  });
}

// Load settings when extension starts
chrome.storage.sync.get('tabOrganizerSettings', (data) => {
  console.log('Loading settings from storage:', data);
  if (data.tabOrganizerSettings) {
    settings = data.tabOrganizerSettings;
    console.log('Settings loaded:', settings);
  } else {
    console.log('No settings found, using defaults:', settings);
    // 保存默认设置
    saveSettings();
  }
});

// Listen for changes to settings
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.tabOrganizerSettings) {
    const oldSettings = settings;
    settings = changes.tabOrganizerSettings.newValue;

    // 检查是否需要更新监控状态
    const monitoringSettingsChanged =
      oldSettings.monitoringEnabled !== settings.monitoringEnabled ||
      oldSettings.extensionActive !== settings.extensionActive ||
      oldSettings.continuousMonitoring !== settings.continuousMonitoring ||
      oldSettings.autoGroupInterval !== settings.autoGroupInterval ||
      oldSettings.autoSortInterval !== settings.autoSortInterval;

    if (monitoringSettingsChanged) {
      console.log('监控设置已更改，更新监控状态');
      updateMonitoringStatus();
    }
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
  const fullDomain = extractDomain(url);
  if (!fullDomain) return '';

  // 提取主域名部分（如cursor, bilibili）
  const parts = fullDomain.split('.');

  // 处理特殊情况，如github.io, github.com等
  if (parts.length >= 2) {
    // 检查是否是二级域名服务，如github.io, xxx.com.cn等
    if ((parts[parts.length - 2] === 'github' && parts[parts.length - 1] === 'io') ||
        (parts[parts.length - 2] === 'com' && parts[parts.length - 1] === 'cn')) {
      // 对于github.io或com.cn这样的情况，返回前一部分
      if (parts.length >= 3) {
        return parts[parts.length - 3];
      }
      return fullDomain;
    }

    // 普通情况，返回次级域名（如cursor, bilibili）
    return parts[parts.length - 2];
  }

  // 如果无法解析，返回完整域名
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
    console.log('查询到的标签页:', tabs.length, '个');

    if (!tabs || tabs.length === 0) {
      console.log('没有标签页，退出');
      return true;
    }

    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    console.log('当前窗口的标签组:', groups.length, '个');

    // 创建域名到组ID的映射
    const domainToGroupId = {};
    for (const group of groups) {
      if (group.title) {
        domainToGroupId[group.title] = group.id;
      }
    }
    console.log('域名到组ID的映射:', domainToGroupId);

    // 按域名分组
    const domainGroups = {};
    const existingGroups = {};

    for (const tab of tabs) {
      if (!tab.url) continue;

      const domain = getDomainForGrouping(tab.url);
      if (!domain || settings.excludeDomains.includes(domain)) continue;

      // 检查标签页是否已经在正确的组中
      if (tab.groupId !== TAB_GROUP_ID_NONE) {
        try {
          const group = await chrome.tabGroups.get(tab.groupId);
          if (group.title === domain) {
            console.log('标签页已在正确的组中:', tab.id, '组:', group.title);
            continue; // 已经在正确的组中，跳过
          }
        } catch (error) {
          console.error('获取标签组信息失败:', error);
        }
      }

      // 检查是否已存在该域名的组
      if (domainToGroupId[domain]) {
        if (!existingGroups[domain]) {
          existingGroups[domain] = [];
        }
        existingGroups[domain].push(tab.id);
      } else {
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab.id);
      }
    }

    console.log('新域名分组结果:', Object.keys(domainGroups).length, '个组');
    console.log('已存在域名分组结果:', Object.keys(existingGroups).length, '个组');

    // 处理已存在的组
    for (const domain in existingGroups) {
      const tabIds = existingGroups[domain];
      if (tabIds.length === 0) continue;

      console.log('添加到已存在的组:', domain, '标签页数量:', tabIds.length);
      await chrome.tabs.group({ tabIds, groupId: domainToGroupId[domain] });
      console.log('标签页已添加到现有组');
    }

    // 创建新的标签组
    for (const domain in domainGroups) {
      const tabIds = domainGroups[domain];
      if (tabIds.length === 0) continue;

      console.log('创建新组:', domain, '标签页数量:', tabIds.length);
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

// 取消所有标签页分组
async function ungroupAllTabs() {
  console.log('开始取消所有标签页分组');

  // 如果插件处于激活状态，不允许取消分组
  if (settings.extensionActive) {
    console.log('插件处于激活状态，不允许取消分组');
    return { success: false, error: 'Extension is active, ungrouping is not allowed' };
  }

  // 设置手动取消分组标志，防止自动重新分组
  manualUngrouping = true;

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs.length, '个');

    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tab.id);
      }
    }

    console.log('取消分组完成');

    // 操作完成后重置标志
    setTimeout(() => {
      manualUngrouping = false;
      console.log('重置手动取消分组标志');
    }, 1000);

    return { success: true };
  } catch (error) {
    console.error('Error ungrouping all tabs:', error);
    // 出错时也重置标志
    manualUngrouping = false;
    return { success: false, error: error.message };
  }
}

// 对标签组进行排序
async function sortTabGroups() {
  console.log('开始对标签组进行排序');

  try {
    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
    console.log('查询到的标签组:', groups.length, '个');

    if (!groups || groups.length === 0) {
      console.log('没有标签组，无需排序');
      return true;
    }

    // 即使只有一个标签组，也需要对组内标签进行排序
    console.log('对标签组进行排序，包括组内标签');

    // 记录当前标签组的展开/折叠状态
    const groupStates = {};
    for (const group of groups) {
      groupStates[group.id] = group.collapsed;
    }

    // 获取每个组的信息，包括组内标签页和排序分数
    const groupInfo = {};

    for (const group of groups) {
      // 获取组内标签页
      const tabs = await chrome.tabs.query({ groupId: group.id });

      // 计算智能排序分数
      let score;

      if (settings.groupSortingMethod === 'title') {
        // 按标题排序
        score = group.title || '';
      } else if (settings.groupSortingMethod === 'size') {
        // 按大小排序
        score = tabs.length;
      } else {
        // 默认使用智能排序（基于标签页数量）
        score = tabs.length / 10; // 最多10个标签页得满分
      }

      groupInfo[group.id] = {
        group: group,
        tabs: tabs,
        score: score,
        title: group.title,
        color: group.color
      };
    }

    // 根据分数对组进行排序
    let sortedGroups = [...groups];
    sortedGroups.sort((a, b) => {
      const infoA = groupInfo[a.id];
      const infoB = groupInfo[b.id];

      if (settings.groupSortingMethod === 'title') {
        // 字符串比较
        return settings.groupSortAscending ?
          String(infoA.score).localeCompare(String(infoB.score)) :
          String(infoB.score).localeCompare(String(infoA.score));
      } else {
        // 数值比较
        return settings.groupSortAscending ?
          infoA.score - infoB.score :
          infoB.score - infoA.score;
      }
    });

    console.log('排序后的标签组:', sortedGroups.map(g => g.title));

    // 获取所有标签页
    const allTabs = await chrome.tabs.query({ windowId: WINDOW_ID_CURRENT });

    // 创建一个映射，记录每个标签页的组ID
    const tabToGroupMap = {};
    allTabs.forEach(tab => {
      if (tab.groupId !== TAB_GROUP_ID_NONE) {
        tabToGroupMap[tab.id] = tab.groupId;
      }
    });

    // 计算每个标签页的新位置
    console.log('计算每个标签页的新位置');
    let currentIndex = 0;
    const tabPositions = {};

    // 从前向后处理每个组，计算每个标签页的新位置
    for (const group of sortedGroups) {
      const info = groupInfo[group.id];
      const tabs = info.tabs;

      // 保持组内标签的原有顺序，不进行排序
      // 只对标签组进行排序，不改变组内标签的顺序
      tabs.sort((a, b) => a.index - b.index); // 按索引排序，保持原有顺序

      // 计算每个标签页的新位置
      for (const tab of tabs) {
        tabPositions[tab.id] = currentIndex++;
      }
    }

    // 临时取消所有标签页的分组
    console.log('临时取消所有标签页的分组');
    const groupedTabIds = allTabs
      .filter(tab => tab.groupId !== TAB_GROUP_ID_NONE)
      .map(tab => tab.id);

    if (groupedTabIds.length > 0) {
      await chrome.tabs.ungroup(groupedTabIds);
    }

    // 移动所有标签页到新位置
    console.log('移动所有标签页到新位置');
    for (const tabId in tabPositions) {
      try {
        await chrome.tabs.move(parseInt(tabId), { index: tabPositions[tabId] });
      } catch (error) {
        console.error(`移动标签页 ${tabId} 失败:`, error);
      }
    }

    // 从前向后处理每个组，重新创建标签组
    for (const group of sortedGroups) {
      const info = groupInfo[group.id];

      // 获取属于这个组的标签页ID
      const tabIds = info.tabs.map(tab => tab.id);

      if (tabIds.length === 0) {
        console.log('组内没有标签页，跳过:', info.title);
        continue;
      }

      // 创建新的标签组
      console.log(`为 "${info.title}" 创建新的标签组，包含 ${tabIds.length} 个标签页`);
      const newGroupId = await chrome.tabs.group({ tabIds });

      // 设置组标题和颜色
      await chrome.tabGroups.update(newGroupId, {
        title: info.title,
        color: info.color
      });

      // 恢复组的展开/折叠状态
      if (groupStates[group.id] !== undefined) {
        await chrome.tabGroups.update(newGroupId, {
          collapsed: groupStates[group.id]
        });
      }
    }

    console.log('标签组排序完成');
    return true;
  } catch (error) {
    console.error('Error sorting tab groups:', error);
    return false;
  }
}

// 对单个标签组内的标签进行排序
async function sortTabsInGroup(groupId) {
  console.log(`开始对标签组 ${groupId} 内的标签进行排序`);

  try {
    // 获取组内所有标签
    const tabs = await chrome.tabs.query({ groupId: groupId });
    console.log(`标签组 ${groupId} 内有 ${tabs.length} 个标签`);

    if (!tabs || tabs.length <= 1) {
      console.log('标签数量不足，无需排序');
      return true;
    }

    // 获取当前排序方法和排序顺序
    const sortMethod = settings.sortingMethod;
    const sortAscending = settings.sortAscending;

    console.log(`使用排序方法: ${sortMethod}, 排序顺序: ${sortAscending ? '升序' : '降序'}`);

    // 计算每个标签的排序分数
    const tabScores = {};
    for (const tab of tabs) {
      let score;

      if (sortMethod === 'title') {
        // 按标题排序
        score = tab.title || '';
      } else if (sortMethod === 'domain') {
        // 按域名排序
        score = extractDomain(tab.url || '');
      } else if (sortMethod === 'smart') {
        // 智能排序（结合多个因素）
        // 使用更稳定的计算方法，避免随机性
        const urlScore = tab.url ? Math.min(tab.url.length / 100, 1) : 0; // URL长度分数
        const titleScore = tab.title ? Math.min(tab.title.length / 50, 1) : 0; // 标题长度分数
        const domainScore = tab.url ? extractDomain(tab.url).length / 20 : 0; // 域名长度分数

        // 加权平均
        score = (urlScore * 0.4) + (titleScore * 0.4) + (domainScore * 0.2);
      } else {
        // 默认按索引排序
        score = tab.index;
      }

      tabScores[tab.id] = score;
      console.log(`标签 ${tab.id} (${tab.title}) 的排序分数: ${score}`);
    }

    // 根据分数对标签页进行排序
    const sortedTabs = [...tabs].sort((a, b) => {
      const scoreA = tabScores[a.id];
      const scoreB = tabScores[b.id];

      if (typeof scoreA === 'string' && typeof scoreB === 'string') {
        // 字符串比较
        return sortAscending ?
          scoreA.localeCompare(scoreB) :
          scoreB.localeCompare(scoreA);
      } else {
        // 数值比较
        return sortAscending ?
          scoreA - scoreB :
          scoreB - scoreA;
      }
    });

    console.log('排序后的标签顺序:');
    sortedTabs.forEach((tab, index) => {
      console.log(`${index + 1}. ${tab.title} (ID: ${tab.id})`);
    });

    // 找出组内第一个标签的索引作为基准
    // 重新获取组内所有标签（按索引排序）
    const currentTabs = await chrome.tabs.query({ groupId: groupId });
    currentTabs.sort((a, b) => a.index - b.index);

    if (currentTabs.length === 0) {
      console.log('组内没有标签，无法排序');
      return true;
    }

    // 获取组内第一个标签的索引作为基准
    const baseIndex = currentTabs[0].index;
    console.log(`组内第一个标签的索引: ${baseIndex}`);

    // 创建一个映射，记录每个标签的新位置
    const newPositions = {};
    sortedTabs.forEach((tab, i) => {
      newPositions[tab.id] = baseIndex + i;
    });

    console.log('标签的新位置:', newPositions);

    // 按照新的顺序移动标签
    for (let i = 0; i < sortedTabs.length; i++) {
      try {
        const tabId = sortedTabs[i].id;
        const newIndex = newPositions[tabId];

        console.log(`移动标签 ${tabId} (${sortedTabs[i].title}) 到索引 ${newIndex}`);
        await chrome.tabs.move(tabId, { index: newIndex });
      } catch (error) {
        console.error(`移动标签页 ${sortedTabs[i].id} 失败:`, error);
      }
    }

    console.log(`标签组 ${groupId} 内的标签排序完成`);
    return true;
  } catch (error) {
    console.error(`对标签组 ${groupId} 内的标签进行排序失败:`, error);
    return false;
  }
}

// 获取排序指标
async function getSortingMetrics() {
  console.log('获取排序指标');

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

      // 计算组内标签的排序指标
      const tabMetrics = {};
      for (const tab of tabs) {
        let score;

        if (settings.sortingMethod === 'title') {
          // 按标题排序
          score = tab.title || '';
        } else if (settings.sortingMethod === 'domain') {
          // 按域名排序
          score = extractDomain(tab.url || '');
        } else if (settings.sortingMethod === 'smart') {
          // 智能排序（结合多个因素）
          // 使用更稳定的计算方法，避免随机性
          const urlScore = tab.url ? Math.min(tab.url.length / 100, 1) : 0; // URL长度分数
          const titleScore = tab.title ? Math.min(tab.title.length / 50, 1) : 0; // 标题长度分数
          const domainScore = tab.url ? extractDomain(tab.url).length / 20 : 0; // 域名长度分数

          // 加权平均
          score = (urlScore * 0.4) + (titleScore * 0.4) + (domainScore * 0.2);
        } else {
          // 默认按索引排序
          score = tab.index;
        }

        tabMetrics[tab.id] = {
          title: tab.title || 'Unnamed Tab',
          url: tab.url || '',
          index: tab.index,
          score: score
        };

        console.log(`标签 ${tab.id} (${tab.title}) 的排序分数: ${score}`);
      }

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
        sortValue: finalScore.toFixed(2), // 使用最终分数作为排序值
        tabs: tabMetrics // 添加标签排序指标
      };
    }

    console.log('返回排序指标:', Object.keys(metrics).length, '个组的指标');
    return {
      success: true,
      metrics: metrics,
      sortingMethod: settings.groupSortingMethod,
      sortAscending: settings.groupSortAscending,
      tabSortingMethod: settings.sortingMethod,
      tabSortAscending: settings.sortAscending
    };
  } catch (error) {
    console.error('Error getting sorting metrics:', error);
    return { success: false, error: error.message };
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

      // 获取当前窗口的所有标签组
      const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      console.log('当前窗口的标签组:', groups.length, '个');

      // 查找是否已存在该域名的组
      let existingGroupId = null;
      for (const group of groups) {
        if (group.title === domain) {
          existingGroupId = group.id;
          break;
        }
      }

      if (existingGroupId) {
        // 添加到现有组
        console.log('添加到已存在的组:', domain, '组ID:', existingGroupId);
        await chrome.tabs.group({ tabIds: [tab.id], groupId: existingGroupId });
        console.log('标签页已添加到现有组');
      } else {
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
      }
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

      // 检查标签页是否已经在正确的组中
      if (tab.groupId !== TAB_GROUP_ID_NONE) {
        try {
          const group = await chrome.tabGroups.get(tab.groupId);
          if (group.title === domain) {
            console.log('标签页已在正确的组中:', tabId, '组:', group.title);
            return; // 已经在正确的组中，不需要任何操作
          }
        } catch (error) {
          console.error('获取标签组信息失败:', error);
        }
      }

      // 获取当前窗口的所有标签组
      const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      console.log('当前窗口的标签组:', groups.length, '个');

      // 查找是否已存在该域名的组
      let existingGroupId = null;
      for (const group of groups) {
        if (group.title === domain) {
          existingGroupId = group.id;
          break;
        }
      }

      // 如果标签页在其他组中，先移除
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tabId);
      }

      if (existingGroupId) {
        // 添加到现有组
        console.log('添加到已存在的组:', domain, '组ID:', existingGroupId);
        await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroupId });
        console.log('标签页已添加到现有组');
      } else {
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
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }, 500); // Wait 0.5 seconds for the tab to fully update
});

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('收到消息:', message);

  // 测试消息
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

  // 对单个标签组内的标签排序
  if (message.action === 'sortTabsInGroup') {
    console.log('处理 sortTabsInGroup 消息');
    if (!message.groupId) {
      console.error('缺少 groupId 参数');
      sendResponse({ success: false, error: 'Missing groupId parameter' });
      return true;
    }

    sortTabsInGroup(message.groupId).then(success => {
      console.log('sortTabsInGroup 执行结果:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('Error in sortTabsInGroup:', error);
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

      // 更新监控状态
      updateMonitoringStatus();
    } else {
      // 停止监控
      stopContinuousMonitoring();
    }

    sendResponse({
      success: true,
      active: settings.extensionActive
    });
    return true;
  }

  // 切换持续监控状态
  if (message.action === 'toggleMonitoring') {
    console.log('处理 toggleMonitoring 消息');
    const newState = message.enabled !== undefined ? message.enabled : !settings.monitoringEnabled;
    settings.monitoringEnabled = newState;

    // 更新监控状态
    updateMonitoringStatus();

    sendResponse({
      success: true,
      monitoringEnabled: settings.monitoringEnabled
    });
    return true;
  }

  // 更新监控设置
  if (message.action === 'updateMonitoringSettings') {
    console.log('处理 updateMonitoringSettings 消息');

    if (message.autoGroupInterval !== undefined) {
      settings.autoGroupInterval = message.autoGroupInterval;
    }

    if (message.autoSortInterval !== undefined) {
      settings.autoSortInterval = message.autoSortInterval;
    }

    // 更新监控状态
    updateMonitoringStatus();

    sendResponse({
      success: true,
      settings: settings
    });
    return true;
  }

  // 更新排序方法
  if (message.action === 'updateSortingMethod') {
    console.log('处理 updateSortingMethod 消息');

    if (message.method !== undefined) {
      settings.groupSortingMethod = message.method;

      // 如果更新了排序方法，自动执行一次排序
      if (settings.extensionActive && settings.enableGroupSorting) {
        sortTabGroups().then(() => {
          console.log('排序方法已更新，已重新排序标签组');
        }).catch(error => {
          console.error('排序标签组失败:', error);
        });
      }
    }

    sendResponse({
      success: true,
      settings: settings
    });
    return true;
  }

  // 切换排序顺序
  if (message.action === 'toggleSortOrder') {
    console.log('处理 toggleSortOrder 消息');

    // 切换排序顺序
    settings.groupSortAscending = !settings.groupSortAscending;

    // 如果切换了排序顺序，自动执行一次排序
    if (settings.extensionActive && settings.enableGroupSorting) {
      sortTabGroups().then(() => {
        console.log('排序顺序已切换，已重新排序标签组');
      }).catch(error => {
        console.error('排序标签组失败:', error);
      });
    }

    sendResponse({
      success: true,
      settings: settings,
      sortAscending: settings.groupSortAscending
    });
    return true;
  }

  // 更新监控间隔
  if (message.action === 'updateMonitoringInterval') {
    console.log('处理 updateMonitoringInterval 消息');

    if (message.interval !== undefined && message.interval >= 1000) {
      settings.autoGroupInterval = message.interval;

      // 保存设置
      saveSettings();

      // 更新监控状态
      updateMonitoringStatus();

      console.log('监控间隔已更新为:', settings.autoGroupInterval);
    }

    sendResponse({
      success: true,
      interval: settings.autoGroupInterval
    });
    return true;
  }

  // 获取下一次执行时间
  if (message.action === 'getNextExecutionTime') {
    console.log('处理 getNextExecutionTime 消息');

    sendResponse({
      success: true,
      nextExecutionTime: nextExecutionTime,
      monitoringEnabled: settings.monitoringEnabled,
      extensionActive: settings.extensionActive,
      autoGroupInterval: settings.autoGroupInterval
    });
    return true;
  }

  // 未知消息
  console.warn('收到未知消息:', message);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// 定时器ID和下一次执行时间
let autoGroupTimerId = null; // 用于自动监控的定时器ID
let nextExecutionTime = 0; // 下一次执行时间的时间戳

// 启动持续监控
function startContinuousMonitoring() {
  if (!settings.monitoringEnabled || !settings.extensionActive) {
    console.log('持续监控未启用或扩展未激活，不启动监控');
    return;
  }

  console.log('启动持续监控');

  // 停止现有的定时器（如果有）
  stopContinuousMonitoring();

  // 启动综合监控定时器（包含分组、标签组排序和组内标签排序）
  if (settings.autoGroupInterval > 0) {
    // 设置下一次执行时间
    nextExecutionTime = Date.now() + settings.autoGroupInterval;
    console.log('下一次执行时间:', new Date(nextExecutionTime).toLocaleString());

    autoGroupTimerId = setInterval(async () => {
      if (settings.extensionActive && !manualUngrouping) {
        console.log('执行自动监控任务');
        console.log('当前设置状态:', {
          autoGroupByDomain: settings.autoGroupByDomain,
          enableGroupSorting: settings.enableGroupSorting,
          enableTabSorting: settings.enableTabSorting
        });

        try {
          // 1. 首先对标签进行分组
          if (settings.autoGroupByDomain) {
            console.log('执行自动分组');
            await groupTabsByDomain();
          } else {
            console.log('自动分组未启用，跳过分组步骤');
          }

          // 2. 然后对标签组进行排序 - 强制执行，确保排序生效
          console.log('执行自动标签组排序');
          const groupSortResult = await sortTabGroups();
          console.log('标签组排序结果:', groupSortResult ? '成功' : '失败');

          // 3. 最后对每个标签组内的标签进行排序 - 强制执行，确保排序生效
          console.log('执行自动标签组内标签排序');

          // 获取所有标签组
          const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
          console.log('找到', groups.length, '个标签组需要排序');

          // 对每个标签组内的标签进行排序
          for (const group of groups) {
            console.log('排序标签组:', group.id, group.title || '未命名组');
            const tabSortResult = await sortTabsInGroup(group.id);
            console.log('标签组内标签排序结果:', tabSortResult ? '成功' : '失败');
          }

          console.log('自动监控任务完成');
        } catch (error) {
          console.error('自动监控任务出错:', error);
        } finally {
          // 更新下一次执行时间
          nextExecutionTime = Date.now() + settings.autoGroupInterval;
          console.log('下一次执行时间:', new Date(nextExecutionTime).toLocaleString());
        }
      }
    }, settings.autoGroupInterval);
    console.log('自动监控定时器已启动，间隔:', settings.autoGroupInterval, 'ms');
  }
}

// 停止持续监控
function stopContinuousMonitoring() {
  console.log('停止持续监控');

  // 清除自动监控定时器
  if (autoGroupTimerId) {
    clearInterval(autoGroupTimerId);
    autoGroupTimerId = null;
    console.log('自动监控定时器已停止');
  }

  // 重置下一次执行时间
  nextExecutionTime = 0;
}

// 根据设置更新监控状态
function updateMonitoringStatus() {
  console.log('更新监控状态，当前设置:', {
    monitoringEnabled: settings.monitoringEnabled,
    extensionActive: settings.extensionActive,
    autoGroupInterval: settings.autoGroupInterval,
    autoGroupByDomain: settings.autoGroupByDomain,
    enableGroupSorting: settings.enableGroupSorting,
    enableTabSorting: settings.enableTabSorting
  });

  // 无论如何先停止现有的监控
  stopContinuousMonitoring();

  // 如果启用了监控且扩展处于激活状态，则启动监控
  if (settings.monitoringEnabled && settings.extensionActive) {
    startContinuousMonitoring();
  }
}

// 在扩展初始化时启动监控
updateMonitoringStatus();

// 输出初始化完成消息
console.log('Edge Tab Organizer - Background Service Worker 初始化完成');
