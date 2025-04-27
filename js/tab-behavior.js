/**
 * 标签行为跟踪模块
 *
 * 该模块负责收集和管理标签的使用行为数据，包括：
 * - 访问频率（标签被点击/激活的次数）
 * - 最近访问时间（上次访问标签的时间戳）
 * - 停留时间（用户在标签上花费的总时间）
 */

// 标签元数据存储
let tabMetadata = {};

// 当前活动标签ID
let currentActiveTabId = null;
let lastActivationTime = null;

/**
 * 初始化行为跟踪模块
 */
export async function initBehaviorTracking() {
  console.log('初始化标签行为跟踪模块');

  // 加载已有数据
  try {
    const result = await chrome.storage.local.get('tabMetadata');
    if (result.tabMetadata) {
      tabMetadata = result.tabMetadata;
      console.log(`已加载 ${Object.keys(tabMetadata).length} 个标签的行为数据`);
    }
  } catch (error) {
    console.error('加载标签行为数据失败:', error);
  }

  // 获取当前活动标签
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length > 0) {
      currentActiveTabId = tabs[0].id;
      lastActivationTime = Date.now();
    }
  } catch (error) {
    console.error('获取当前活动标签失败:', error);
  }

  // 设置事件监听器
  setupEventListeners();
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 监听标签激活事件
  chrome.tabs.onActivated.addListener(handleTabActivated);

  // 监听标签更新事件
  chrome.tabs.onUpdated.addListener(handleTabUpdated);

  // 监听标签关闭事件
  chrome.tabs.onRemoved.addListener(handleTabRemoved);

  // 监听窗口焦点变化事件
  chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);
}

/**
 * 处理标签激活事件
 * @param {Object} activeInfo - 激活信息
 */
async function handleTabActivated(activeInfo) {
  const { tabId } = activeInfo;
  const now = Date.now();

  // 更新上一个活动标签的停留时间
  updatePreviousTabTime(now);

  // 更新当前标签的访问数据
  updateTabAccessData(tabId, now);

  // 更新当前活动标签
  currentActiveTabId = tabId;
  lastActivationTime = now;
}

/**
 * 处理标签更新事件
 * @param {number} tabId - 标签ID
 * @param {Object} changeInfo - 变更信息
 * @param {Object} tab - 标签对象
 */
function handleTabUpdated(tabId, changeInfo, tab) {
  // 只在标签完成加载时更新创建时间
  if (changeInfo.status === 'complete') {
    if (!tabMetadata[tabId]) {
      updateTabAccessData(tabId, Date.now());
    }
  }
}

/**
 * 处理标签关闭事件
 * @param {number} tabId - 标签ID
 */
function handleTabRemoved(tabId) {
  // 如果关闭的是当前活动标签，更新停留时间
  if (tabId === currentActiveTabId) {
    updatePreviousTabTime(Date.now());
    currentActiveTabId = null;
    lastActivationTime = null;
  }

  // 清理标签数据
  if (tabMetadata[tabId]) {
    delete tabMetadata[tabId];
    saveTabMetadata();
  }
}

/**
 * 处理窗口焦点变化事件
 * @param {number} windowId - 窗口ID
 */
async function handleWindowFocusChanged(windowId) {
  // 窗口失去焦点
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // 更新当前标签的停留时间
    updatePreviousTabTime(Date.now());
    lastActivationTime = null;
  } else {
    // 窗口获得焦点，获取当前活动标签
    try {
      const tabs = await chrome.tabs.query({active: true, windowId: windowId});
      if (tabs.length > 0) {
        const now = Date.now();
        currentActiveTabId = tabs[0].id;
        lastActivationTime = now;

        // 更新访问数据
        updateTabAccessData(currentActiveTabId, now);
      }
    } catch (error) {
      console.error('获取当前活动标签失败:', error);
    }
  }
}

/**
 * 更新上一个标签的停留时间
 * @param {number} now - 当前时间戳
 */
function updatePreviousTabTime(now) {
  if (currentActiveTabId && tabMetadata[currentActiveTabId] && lastActivationTime) {
    const timeSpent = now - lastActivationTime;

    // 只有合理的时间才计入（避免异常值，最多1小时）
    if (timeSpent > 0 && timeSpent < 3600000) {
      tabMetadata[currentActiveTabId].totalTime =
        (tabMetadata[currentActiveTabId].totalTime || 0) + timeSpent;

      // 保存数据
      saveTabMetadata();
    }
  }
}

/**
 * 更新标签访问数据
 * @param {number} tabId - 标签ID
 * @param {number} timestamp - 时间戳
 */
async function updateTabAccessData(tabId, timestamp) {
  try {
    // 获取标签信息
    const tab = await chrome.tabs.get(tabId);

    // 初始化标签元数据
    if (!tabMetadata[tabId]) {
      tabMetadata[tabId] = {
        accessCount: 0,
        totalTime: 0,
        createdAt: timestamp
      };
    }

    // 更新访问数据
    tabMetadata[tabId].accessCount++;
    tabMetadata[tabId].lastAccess = timestamp;

    // 保存数据
    saveTabMetadata();
  } catch (error) {
    // 标签可能已关闭
    console.log(`无法获取标签 ${tabId} 信息:`, error);
  }
}

/**
 * 保存标签元数据到存储
 */
function saveTabMetadata() {
  chrome.storage.local.set({ tabMetadata }).catch(error => {
    console.error('保存标签元数据失败:', error);
  });
}

/**
 * 获取标签元数据
 * @param {number} tabId - 标签ID
 * @returns {Object|null} 标签元数据
 */
export function getTabMetadata(tabId) {
  return tabMetadata[tabId] || null;
}

/**
 * 获取所有标签元数据
 * @returns {Object} 所有标签元数据
 */
export function getAllTabMetadata() {
  return tabMetadata;
}

/**
 * 计算基于行为的标签分数
 * @param {Object} tab - 标签对象
 * @returns {number} 分数
 */
export function calculateBehaviorScore(tab) {
  const metadata = tabMetadata[tab.id];

  // 如果没有元数据，返回默认值
  if (!metadata) {
    return {
      finalScore: 0,
      components: {
        accessScore: 0,
        recencyScore: 0,
        timeScore: 0
      }
    };
  }

  const now = Date.now();

  // 1. 访问频率分数 (0-1)
  const accessScore = Math.min(metadata.accessCount / 20, 1); // 最多20次访问获得满分

  // 2. 最近访问分数 (0-1)
  // 使用时间衰减函数：1天内访问=1.0，7天后=0.1
  const daysSinceLastAccess = (now - (metadata.lastAccess || 0)) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, Math.min(1, 1 - (daysSinceLastAccess / 7)));

  // 3. 停留时间分数 (0-1)
  // 总停留时间超过30分钟获得满分
  const timeScore = Math.min((metadata.totalTime || 0) / (30 * 60 * 1000), 1);

  // 加权计算最终分数
  return {
    finalScore: (accessScore * 0.4) + (recencyScore * 0.4) + (timeScore * 0.2),
    components: {
      accessScore,
      recencyScore,
      timeScore
    }
  };
}

/**
 * 计算标签组的行为分数
 * @param {Array} tabs - 组内标签数组
 * @returns {number} 分数
 */
export function calculateGroupBehaviorScore(tabs) {
  if (!tabs || tabs.length === 0) {
    return {
      finalScore: 0,
      components: {
        accessScore: 0,
        recencyScore: 0,
        timeScore: 0
      }
    };
  }

  let totalAccessScore = 0;
  let totalRecencyScore = 0;
  let totalTimeScore = 0;
  let validTabs = 0;
  let mostRecentAccess = 0;

  for (const tab of tabs) {
    const metadata = tabMetadata[tab.id];
    if (metadata) {
      // 访问频率
      const accessScore = Math.min(metadata.accessCount / 20, 1);
      totalAccessScore += accessScore;

      // 最近访问（找出组内最近访问的标签）
      if (metadata.lastAccess && metadata.lastAccess > mostRecentAccess) {
        mostRecentAccess = metadata.lastAccess;
      }

      // 停留时间
      const timeScore = Math.min((metadata.totalTime || 0) / (30 * 60 * 1000), 1);
      totalTimeScore += timeScore;

      validTabs++;
    }
  }

  // 如果没有有效的标签元数据，返回默认值
  if (validTabs === 0) {
    return {
      finalScore: 0,
      components: {
        accessScore: 0,
        recencyScore: 0,
        timeScore: 0
      }
    };
  }

  // 计算平均分数
  const avgAccessScore = totalAccessScore / validTabs;
  const avgTimeScore = totalTimeScore / validTabs;

  // 计算组的最近访问分数
  const now = Date.now();
  const daysSinceLastAccess = mostRecentAccess > 0 ? (now - mostRecentAccess) / (1000 * 60 * 60 * 24) : 7;
  const recencyScore = Math.max(0, Math.min(1, 1 - (daysSinceLastAccess / 7)));

  // 加权计算最终分数
  return {
    finalScore: (avgAccessScore * 0.4) + (recencyScore * 0.4) + (avgTimeScore * 0.2),
    components: {
      accessScore: avgAccessScore,
      recencyScore: recencyScore,
      timeScore: avgTimeScore
    }
  };
}

/**
 * 格式化时间差
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化的时间差
 */
export function formatTimeDifference(timestamp) {
  if (!timestamp) return '从未';

  const now = Date.now();
  const diffMinutes = Math.floor((now - timestamp) / (1000 * 60));

  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}天前`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}个月前`;
}

/**
 * 格式化时间
 * @param {number} milliseconds - 毫秒数
 * @returns {string} 格式化的时间
 */
export function formatTime(milliseconds) {
  if (!milliseconds) return '0分钟';

  const minutes = Math.floor(milliseconds / (1000 * 60));
  if (minutes < 60) return `${minutes}分钟`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours}小时`;
  return `${hours}小时${remainingMinutes}分钟`;
}
