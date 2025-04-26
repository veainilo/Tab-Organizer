// Helper function to get localized message
function getMessage(messageName, substitutions) {
  return chrome.i18n.getMessage(messageName, substitutions);
}

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
// Edge 浏览器支持的标签组颜色
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// 用于智能分配的颜色序列
// 这个顺序经过精心设计，确保相邻颜色有足够的视觉差异
const colorSequence = [
  'blue', 'red', 'green', 'orange', 'purple',
  'cyan', 'pink', 'yellow', 'grey'
];

// 域名到颜色的映射缓存
const domainColorCache = {};

// 已分配的颜色计数
const colorUsageCount = {};
// 初始化颜色使用计数
baseColors.forEach(color => colorUsageCount[color] = 0);

// 当前已分配的域名列表
const assignedDomains = [];

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

// 计算两个域名的相似度 (0-1)
function calculateDomainSimilarity(domain1, domain2) {
  // 如果域名完全相同，相似度为1
  if (domain1 === domain2) return 1;

  // 如果域名长度差异太大，相似度较低
  const lengthDiff = Math.abs(domain1.length - domain2.length);
  if (lengthDiff > 5) return 0.1;

  // 计算最长公共子序列
  const lcs = longestCommonSubsequence(domain1, domain2);
  const similarity = lcs / Math.max(domain1.length, domain2.length);

  return similarity;
}

// 计算最长公共子序列长度
function longestCommonSubsequence(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
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
    colorUsageCount[domainColorCache[domain]] = (colorUsageCount[domainColorCache[domain]] || 0) + 1;
    assignedDomains.push(domain);
    return domainColorCache[domain];
  }

  // 如果启用了动态颜色分配
  if (settings.useDynamicColors) {
    // 如果是第一个域名，使用第一个颜色
    if (assignedDomains.length === 0) {
      domainColorCache[domain] = colorSequence[0];
      colorUsageCount[colorSequence[0]] += 1;
      assignedDomains.push(domain);
      return domainColorCache[domain];
    }

    // 计算与现有域名的相似度
    const similarityScores = {};
    for (const existingDomain of assignedDomains) {
      const similarity = calculateDomainSimilarity(domain, existingDomain);
      const existingColor = domainColorCache[existingDomain];

      if (!similarityScores[existingColor]) {
        similarityScores[existingColor] = 0;
      }

      // 相似度越高，分数越高
      similarityScores[existingColor] += similarity;
    }

    // 为每种颜色计算一个总分数
    // 分数越低越好（我们想要选择与现有域名最不相似的颜色）
    const colorScores = {};
    for (const color of baseColors) {
      // 基础分数：颜色使用次数
      colorScores[color] = colorUsageCount[color] * 2;

      // 加上相似度分数
      if (similarityScores[color]) {
        colorScores[color] += similarityScores[color] * 10;
      }
    }

    // 选择分数最低的颜色
    let bestColor = baseColors[0];
    let lowestScore = colorScores[bestColor];

    for (const color of baseColors) {
      if (colorScores[color] < lowestScore) {
        lowestScore = colorScores[color];
        bestColor = color;
      }
    }

    // 如果所有颜色都已使用，尝试使用颜色序列中的下一个
    if (assignedDomains.length < colorSequence.length && colorUsageCount[bestColor] > 0) {
      const nextColorIndex = assignedDomains.length % colorSequence.length;
      const nextColor = colorSequence[nextColorIndex];

      // 如果下一个颜色的分数不是太高，使用它
      if (colorScores[nextColor] - lowestScore < 5) {
        bestColor = nextColor;
      }
    }

    // 保存结果并更新计数
    domainColorCache[domain] = bestColor;
    colorUsageCount[bestColor] += 1;
    assignedDomains.push(domain);

    return bestColor;
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
