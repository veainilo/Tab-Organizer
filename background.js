// Default settings
let settings = {
  autoGroupByDomain: true,
  autoGroupOnCreation: true,
  groupByRootDomain: true,  // 按根域名分组
  ignoreTLD: true,          // 忽略顶级域名（如.com, .org等）
  useDynamicColors: true,   // 动态分配颜色
  excludeDomains: [],
  colorScheme: {
    'default': 'blue'
  }
};

// 可用的标签组颜色
const availableColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// 域名到颜色的映射缓存
const domainColorCache = {};

// Define constant for ungrouped tabs
const TAB_GROUP_ID_NONE = -1;

// Load settings when extension starts
chrome.storage.sync.get('tabOrganizerSettings', (data) => {
  if (data.tabOrganizerSettings) {
    settings = data.tabOrganizerSettings;
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

// 为域名生成一致的颜色
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

  // 如果启用了动态颜色分配
  if (settings.useDynamicColors) {
    // 使用简单的哈希函数为域名生成一个数字
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = ((hash << 5) - hash) + domain.charCodeAt(i);
      hash |= 0; // 转换为32位整数
    }

    // 使用哈希值选择一个颜色
    const colorIndex = Math.abs(hash) % availableColors.length;
    domainColorCache[domain] = availableColors[colorIndex];
    return domainColorCache[domain];
  }

  // 默认返回蓝色
  return settings.colorScheme['default'] || 'blue';
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

// Group tabs by domain
async function groupTabsByDomain() {
  try {
    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Group tabs by domain
    const domainGroups = {};

    tabs.forEach(tab => {
      if (!tab.url) return;

      const domain = getDomainForGrouping(tab.url);
      if (!domain || settings.excludeDomains.includes(domain)) return;

      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }

      domainGroups[domain].push(tab.id);
    });

    // Create or update groups
    for (const domain in domainGroups) {
      const tabIds = domainGroups[domain];

      // 不再跳过单个标签页，所有标签页都分组

      // Check if any of these tabs are already in a group with the same domain
      let existingGroupId = null;

      for (const tabId of tabIds) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(tab.groupId);
          if (group.title === domain) {
            existingGroupId = tab.groupId;
            break;
          }
        }
      }

      if (existingGroupId) {
        // Add tabs to existing group
        await chrome.tabs.group({ tabIds, groupId: existingGroupId });
      } else {
        // Create new group
        const groupId = await chrome.tabs.group({ tabIds });

        // Set group title and color
        const color = getColorForDomain(domain);
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: color
        });
      }
    }
  } catch (error) {
    console.error('Error grouping tabs by domain:', error);
  }
}

// Handle tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!settings.autoGroupOnCreation) return;

  // Wait a moment for the tab to load
  setTimeout(async () => {
    try {
      // Get updated tab info
      const updatedTab = await chrome.tabs.get(tab.id);

      if (!updatedTab.url) return;

      const domain = getDomainForGrouping(updatedTab.url);
      if (!domain || settings.excludeDomains.includes(domain)) return;

      // Find existing group with this domain
      const tabs = await chrome.tabs.query({ currentWindow: true });
      let existingGroupId = null;

      for (const t of tabs) {
        if (t.id === tab.id) continue;
        if (t.groupId && t.groupId !== TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(t.groupId);
          if (group.title === domain) {
            existingGroupId = t.groupId;
            break;
          }
        }
      }

      if (existingGroupId) {
        // Add tab to existing group
        await chrome.tabs.group({ tabIds: [tab.id], groupId: existingGroupId });
      } else {
        // Check if there are other tabs with the same domain
        const sameDomainTabs = tabs.filter(t =>
          t.id !== tab.id &&
          t.url &&
          getDomainForGrouping(t.url) === domain
        );

        // 即使没有其他相同域名的标签页，也创建组
        const tabIds = sameDomainTabs.length > 0 ?
          [tab.id, ...sameDomainTabs.map(t => t.id)] : [tab.id];

        const groupId = await chrome.tabs.group({ tabIds });

        // Set group title and color
        const color = getColorForDomain(domain);
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: color
        });
      }
    } catch (error) {
      console.error('Error handling new tab:', error);
    }
  }, 1000); // Wait 1 second for the tab to load
});

// Handle tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!settings.autoGroupByDomain) return;
  if (!changeInfo.url) return;

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

      // Find existing group with this domain
      const tabs = await chrome.tabs.query({ currentWindow: true });
      let existingGroupId = null;

      for (const t of tabs) {
        if (t.id === tabId) continue;
        if (t.groupId && t.groupId !== TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(t.groupId);
          if (group.title === domain) {
            existingGroupId = t.groupId;
            break;
          }
        }
      }

      // If tab is already in the correct group, do nothing
      if (tab.groupId === existingGroupId) return;

      // If tab is in a different group, remove it
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tabId);
      }

      if (existingGroupId) {
        // Add tab to existing group
        await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroupId });
      } else {
        // Check if there are other tabs with the same domain
        const sameDomainTabs = tabs.filter(t =>
          t.id !== tabId &&
          t.url &&
          getDomainForGrouping(t.url) === domain
        );

        // 即使没有其他相同域名的标签页，也创建组
        const tabIds = sameDomainTabs.length > 0 ?
          [tabId, ...sameDomainTabs.map(t => t.id)] : [tabId];

        const groupId = await chrome.tabs.group({ tabIds });

        // Set group title and color
        const color = getColorForDomain(domain);
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: color
        });
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }, 500); // Wait 0.5 seconds for the tab to fully update
});

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'groupByDomain') {
    groupTabsByDomain().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error in groupByDomain:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Indicates async response
  }

  if (message.action === 'ungroupAll') {
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      try {
        for (const tab of tabs) {
          if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
            await chrome.tabs.ungroup(tab.id);
          }
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error in ungroupAll:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Indicates async response
  }
});
