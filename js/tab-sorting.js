/**
 * 标签排序逻辑模块
 */

import { WINDOW_ID_CURRENT, extractDomain } from './utils.js';
import { settings } from './settings.js';

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

// 导出函数
export {
  sortTabsInGroup,
  getSortingMetrics
};
