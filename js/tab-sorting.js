/**
 * 标签排序逻辑模块
 */

import { WINDOW_ID_CURRENT, extractDomain } from './utils.js';
import { settings } from './settings.js';
import { calculateTabScore, calculateGroupScore, sortTabsByScore } from './scoring.js';

/**
 * 对单个标签组内的标签进行排序
 * @param {number} groupId - 标签组ID
 * @returns {Promise<boolean>} 是否成功
 */
async function sortTabsInGroup(groupId) {
  console.log(`开始对标签组 ${groupId} 内的标签进行排序`);
  console.log('当前标签排序设置:', {
    sortingMethod: settings.sortingMethod,
    sortAscending: settings.sortAscending
  });

  try {
    // 获取组内所有标签
    const tabs = await chrome.tabs.query({ groupId: groupId });
    console.log(`标签组 ${groupId} 内有 ${tabs.length} 个标签`);

    if (!tabs || tabs.length <= 1) {
      console.log('标签数量不足，无需排序');
      return true;
    }

    // 记录当前标签的顺序
    console.log('当前标签顺序:');
    tabs.sort((a, b) => a.index - b.index);
    tabs.forEach((tab, index) => {
      console.log(`${index + 1}. [${tab.id}] ${tab.title} (${tab.url})`);
    });

    // 获取当前排序方法和排序顺序
    const sortMethod = settings.sortingMethod;
    const sortAscending = settings.sortAscending;

    console.log(`使用排序方法: ${sortMethod}, 排序顺序: ${sortAscending ? '升序' : '降序'}`);

    // 计算每个标签的排序分数
    const tabScores = {};
    for (const tab of tabs) {
      // 使用统一的评分函数
      const score = calculateTabScore(tab, sortMethod);
      tabScores[tab.id] = score;
      console.log(`标签 ${tab.id} (${tab.title}) 的排序分数: ${score}`);
    }

    // 使用统一的排序函数根据分数对标签页进行排序
    const sortedTabs = sortTabsByScore(tabs, tabScores, sortAscending);

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

    // 创建当前标签位置的映射
    const currentPositions = {};
    currentTabs.forEach(tab => {
      currentPositions[tab.id] = tab.index;
    });

    // 找出需要移动的标签（当前位置与目标位置不同的标签）
    const tabsToMove = [];
    for (let i = 0; i < sortedTabs.length; i++) {
      const tabId = sortedTabs[i].id;
      const currentIndex = currentPositions[tabId];
      const newIndex = newPositions[tabId];

      // 如果当前位置与目标位置不同，则需要移动
      if (currentIndex !== newIndex) {
        tabsToMove.push({
          id: tabId,
          title: sortedTabs[i].title,
          currentIndex: currentIndex,
          newIndex: newIndex
        });
      }
    }

    console.log(`需要移动的标签数量: ${tabsToMove.length}/${sortedTabs.length}`);

    // 如果没有标签需要移动，直接返回
    if (tabsToMove.length === 0) {
      console.log('所有标签已经在正确的位置，无需移动');
      return true;
    }

    // 按照新的顺序移动标签（只移动需要调整的标签）
    // 从后向前移动，避免移动过程中索引变化导致的问题
    tabsToMove.sort((a, b) => b.newIndex - a.newIndex);

    for (const tabToMove of tabsToMove) {
      try {
        console.log(`移动标签 ${tabToMove.id} (${tabToMove.title}) 从索引 ${tabToMove.currentIndex} 到索引 ${tabToMove.newIndex}`);
        await chrome.tabs.move(tabToMove.id, { index: tabToMove.newIndex });
      } catch (error) {
        console.error(`移动标签页 ${tabToMove.id} 失败:`, error);
      }
    }

    // 验证排序结果
    console.log('验证排序结果');
    const sortedTabsAfter = await chrome.tabs.query({ groupId: groupId });
    sortedTabsAfter.sort((a, b) => a.index - b.index);

    console.log('排序后的标签顺序:');
    sortedTabsAfter.forEach((tab, index) => {
      console.log(`${index + 1}. [${tab.id}] ${tab.title} (${tab.url})`);
    });

    console.log(`标签组 ${groupId} 内的标签排序完成`);
    return true;
  } catch (error) {
    console.error(`对标签组 ${groupId} 内的标签进行排序失败:`, error);
    return false;
  }
}

/**
 * 获取排序指标
 * @returns {Promise<Object>} 排序指标
 */
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

      // 创建固定的访问时间和创建时间（实际应用中应该使用真实数据）
      // 使用固定值而不是随机值，确保每次计算结果一致
      const accessTime = now - 1800000; // 30分钟前
      const createTime = now - 43200000; // 12小时前

      // 使用统一的评分函数计算组的分数
      const finalScore = calculateGroupScore(group, tabs, 'smart');

      // 计算组内标签的排序指标
      const tabMetrics = {};
      for (const tab of tabs) {
        // 使用统一的评分函数
        const score = calculateTabScore(tab, settings.sortingMethod);

        tabMetrics[tab.id] = {
          title: tab.title || 'Unnamed Tab',
          url: tab.url || '',
          index: tab.index,
          score: score
        };

        console.log(`标签 ${tab.id} (${tab.title}) 的排序分数: ${score}`);
      }

      // 为了保持向后兼容，保留一些旧的字段
      const accessScore = 0.5; // 固定值，避免随机性
      const sizeScore = Math.min(size / 10, 1);
      const createScore = 0.5; // 固定值，避免随机性
      const accessWeight = 0.5;
      const sizeWeight = 0.3;
      const createWeight = 0.2;

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

// 导出函数
export {
  sortTabsInGroup,
  getSortingMetrics
};
