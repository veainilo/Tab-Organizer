/**
 * 标签组排序逻辑模块
 */

import { WINDOW_ID_CURRENT, TAB_GROUP_ID_NONE } from './utils.js';
import { settings } from './settings.js';

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

// 导出函数
export {
  sortTabGroups
};
