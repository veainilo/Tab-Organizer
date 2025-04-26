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
  },
  // 新增设置项
  continuousMonitoring: true,     // 持续监控标签状态
  autoGroupInterval: 5000,        // 自动分组间隔（毫秒）
  autoSortInterval: 10000,        // 自动排序间隔（毫秒）
  monitoringEnabled: true         // 是否启用监控
};

// 可用的标签组颜色
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

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

    if (!groups || groups.length <= 1) {
      console.log('标签组数量不足，无需排序');
      return true;
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
        score: score
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

    // 计算每个组的新位置
    let currentIndex = 0;
    const groupPositions = {};

    // 首先计算每个组的起始位置
    for (const group of sortedGroups) {
      groupPositions[group.id] = currentIndex;
      currentIndex += groupInfo[group.id].tabs.length;
    }

    console.log('计算的组位置:', groupPositions);

    // 从后向前移动每个组（这样可以避免位置计算错误）
    for (let i = sortedGroups.length - 1; i >= 0; i--) {
      const group = sortedGroups[i];
      const tabs = groupInfo[group.id].tabs;

      if (tabs.length === 0) {
        console.log('组内没有标签页，跳过:', group.title);
        continue;
      }

      // 获取组内所有标签的ID
      const tabIds = tabs.map(tab => tab.id);

      // 移动整个组到新位置
      console.log(`移动组 "${group.title}" 到位置 ${groupPositions[group.id]}`);
      await chrome.tabs.move(tabIds, { index: groupPositions[group.id] });
    }

    console.log('标签组排序完成');
    return true;
  } catch (error) {
    console.error('Error sorting tab groups:', error);
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

  // 未知消息
  console.warn('收到未知消息:', message);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// 定时器ID
let autoGroupTimerId = null;
let autoSortTimerId = null;

// 启动持续监控
function startContinuousMonitoring() {
  if (!settings.monitoringEnabled || !settings.extensionActive) {
    console.log('持续监控未启用或扩展未激活，不启动监控');
    return;
  }

  console.log('启动持续监控');

  // 停止现有的定时器（如果有）
  stopContinuousMonitoring();

  // 启动自动分组定时器
  if (settings.continuousMonitoring && settings.autoGroupInterval > 0) {
    autoGroupTimerId = setInterval(async () => {
      if (settings.extensionActive && !manualUngrouping) {
        console.log('执行自动分组');
        try {
          await groupTabsByDomain();
        } catch (error) {
          console.error('自动分组出错:', error);
        }
      }
    }, settings.autoGroupInterval);
    console.log('自动分组定时器已启动，间隔:', settings.autoGroupInterval, 'ms');
  }

  // 启动自动排序定时器
  if (settings.continuousMonitoring && settings.autoSortInterval > 0 && settings.enableGroupSorting) {
    autoSortTimerId = setInterval(async () => {
      if (settings.extensionActive && !manualUngrouping) {
        console.log('执行自动排序');
        try {
          await sortTabGroups();
        } catch (error) {
          console.error('自动排序出错:', error);
        }
      }
    }, settings.autoSortInterval);
    console.log('自动排序定时器已启动，间隔:', settings.autoSortInterval, 'ms');
  }
}

// 停止持续监控
function stopContinuousMonitoring() {
  console.log('停止持续监控');

  // 清除自动分组定时器
  if (autoGroupTimerId) {
    clearInterval(autoGroupTimerId);
    autoGroupTimerId = null;
    console.log('自动分组定时器已停止');
  }

  // 清除自动排序定时器
  if (autoSortTimerId) {
    clearInterval(autoSortTimerId);
    autoSortTimerId = null;
    console.log('自动排序定时器已停止');
  }
}

// 根据设置更新监控状态
function updateMonitoringStatus() {
  if (settings.monitoringEnabled && settings.extensionActive) {
    startContinuousMonitoring();
  } else {
    stopContinuousMonitoring();
  }
}

// 在扩展初始化时启动监控
updateMonitoringStatus();

// 输出初始化完成消息
console.log('Edge Tab Organizer - Background Service Worker 初始化完成');
