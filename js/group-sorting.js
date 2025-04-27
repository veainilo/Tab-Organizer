/**
 * 标签组排序逻辑模块
 */

import { WINDOW_ID_CURRENT, TAB_GROUP_ID_NONE } from './utils.js';
import { settings } from './settings.js';
import { calculateGroupScore, sortGroupsByScore } from './scoring.js';

/**
 * 对标签组进行排序
 * @returns {Promise<boolean>} 是否成功
 */
async function sortTabGroups() {
  console.log('开始对标签组进行排序');
  console.log('当前设置:', {
    groupSortingMethod: settings.groupSortingMethod,
    groupSortAscending: settings.groupSortAscending
  });

  try {
    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
    console.log('查询到的标签组:', groups.length, '个');
    console.log('标签组详情:', groups.map(g => ({ id: g.id, title: g.title, color: g.color })));

    if (!groups || groups.length === 0) {
      console.log('没有标签组，无需排序');
      return true;
    }

    if (groups.length === 1) {
      console.log('只有一个标签组，无需排序标签组，但会排序组内标签');
      return true;
    }

    console.log('对标签组进行排序，包括组内标签');

    // 记录当前标签组的展开/折叠状态
    const groupStates = {};
    for (const group of groups) {
      groupStates[group.id] = group.collapsed;
      console.log(`标签组 ${group.id} (${group.title || '未命名'}) 的折叠状态:`, group.collapsed);
    }

    // 获取每个组的信息，包括组内标签页和排序分数
    const groupInfo = {};

    for (const group of groups) {
      // 获取组内标签页
      const tabs = await chrome.tabs.query({ groupId: group.id });

      // 使用统一的评分函数计算分数
      const score = calculateGroupScore(group, tabs, settings.groupSortingMethod);

      groupInfo[group.id] = {
        group: group,
        tabs: tabs,
        score: score,
        title: group.title,
        color: group.color
      };
    }

    // 创建组ID到分数的映射
    const groupScores = {};
    for (const group of groups) {
      groupScores[group.id] = groupInfo[group.id].score;
    }

    // 使用统一的排序函数根据分数对组进行排序
    const sortedGroups = sortGroupsByScore(groups, groupScores, settings.groupSortAscending);

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

    // 检查标签组是否需要重新排序
    // 首先，获取当前标签组的顺序
    const currentGroupOrder = {};
    groups.forEach((group, index) => {
      currentGroupOrder[group.id] = index;
    });

    // 检查当前顺序是否与目标顺序相同
    let needsReordering = false;
    for (let i = 0; i < sortedGroups.length; i++) {
      if (sortedGroups[i].id !== groups[i].id) {
        needsReordering = true;
        break;
      }
    }

    // 如果顺序已经正确，无需重新排序
    if (!needsReordering) {
      console.log('标签组已经按照正确的顺序排列，无需重新排序');
      return true;
    }

    console.log('标签组需要重新排序');

    // 尝试使用更高效的方法重新排序标签组
    // 检查是否支持移动标签组的API
    if (chrome.tabGroups && chrome.tabGroups.move) {
      try {
        console.log('尝试使用tabGroups.move API直接移动标签组');

        // 从后向前移动标签组，避免索引变化导致的问题
        for (let i = sortedGroups.length - 1; i >= 0; i--) {
          const group = sortedGroups[i];
          const targetIndex = i;
          const currentIndex = currentGroupOrder[group.id];

          // 只移动位置不正确的标签组
          if (currentIndex !== targetIndex) {
            console.log(`移动标签组 "${group.title || '未命名'}" 从位置 ${currentIndex} 到位置 ${targetIndex}`);
            await chrome.tabGroups.move(group.id, { index: targetIndex });
          }
        }

        console.log('标签组排序完成（使用直接移动方法）');
        return true;
      } catch (error) {
        console.error('使用tabGroups.move API失败，回退到传统方法:', error);
        // 如果直接移动失败，回退到传统方法
      }
    }

    // 传统方法：取消分组并重新创建
    console.log('使用传统方法重新排序标签组');

    // 临时取消所有标签页的分组
    console.log('临时取消所有标签页的分组');
    const groupedTabIds = allTabs
      .filter(tab => tab.groupId !== TAB_GROUP_ID_NONE)
      .map(tab => tab.id);

    if (groupedTabIds.length > 0) {
      await chrome.tabs.ungroup(groupedTabIds);
    }

    // 找出需要移动的标签（当前位置与目标位置不同的标签）
    const tabsToMove = [];
    for (const tabId in tabPositions) {
      const tab = allTabs.find(t => t.id === parseInt(tabId));
      if (tab) {
        const currentIndex = tab.index;
        const newIndex = tabPositions[tabId];

        // 如果当前位置与目标位置不同，则需要移动
        if (currentIndex !== newIndex) {
          tabsToMove.push({
            id: parseInt(tabId),
            currentIndex: currentIndex,
            newIndex: newIndex
          });
        }
      }
    }

    console.log(`需要移动的标签数量: ${tabsToMove.length}/${Object.keys(tabPositions).length}`);

    // 如果没有标签需要移动，但标签组顺序不正确，可能是因为标签组内的标签顺序正确，但标签组顺序不正确
    // 在这种情况下，我们仍然需要重新创建标签组
    if (tabsToMove.length === 0) {
      console.log('标签位置正确，但标签组顺序不正确，只需重新创建标签组');
    } else {
      // 按照新的顺序移动标签（只移动需要调整的标签）
      // 从后向前移动，避免移动过程中索引变化导致的问题
      tabsToMove.sort((a, b) => b.newIndex - a.newIndex);

      for (const tabToMove of tabsToMove) {
        try {
          console.log(`移动标签 ${tabToMove.id} 从索引 ${tabToMove.currentIndex} 到索引 ${tabToMove.newIndex}`);
          await chrome.tabs.move(tabToMove.id, { index: tabToMove.newIndex });
        } catch (error) {
          console.error(`移动标签页 ${tabToMove.id} 失败:`, error);
        }
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

// 导出函数
export {
  sortTabGroups
};
