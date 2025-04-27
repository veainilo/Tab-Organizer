/**
 * 弹出窗口主入口
 */

import { WINDOW_ID_CURRENT, getMessage, localizeUI, showStatus } from './utils.js';
import { loadTabGroups } from './tab-groups-ui.js';
import { loadSortingMetrics, initSortingSettings } from './sorting-ui.js';
import { initMonitoringUI, getNextExecutionTimeAndUpdateCountdown } from './monitoring-ui.js';

// 当文档加载完成时执行
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');

  // 本地化 UI
  localizeUI();

  // 获取 DOM 元素
  const groupListElement = document.getElementById('groupList');
  const noGroupsElement = document.getElementById('noGroups');
  const sortingMetricsElement = document.getElementById('sortingMetrics');
  const sortingMetricsContainer = document.getElementById('sortingMetricsContainer');

  // 获取按钮元素
  const groupByDomainButton = document.getElementById('groupByDomain');
  const ungroupAllButton = document.getElementById('ungroupAll');
  const sortTabGroupsButton = document.getElementById('sortGroups');
  const sortTabsButton = document.getElementById('sortTabs');
  const refreshGroupsButton = document.getElementById('refreshGroups');
  const collapseAllButton = document.getElementById('collapseAll');
  const expandAllButton = document.getElementById('expandAll');
  const createGroupButton = document.getElementById('createGroup');
  const helpButton = document.getElementById('helpButton');

  // 获取搜索元素
  const searchInput = document.getElementById('searchTabs');
  const searchButton = document.getElementById('searchButton');

  // 获取设置元素
  const extensionActiveToggle = document.getElementById('extensionActiveToggle');
  const extensionActiveStatus = document.getElementById('extensionActiveStatus');
  const monitoringToggle = document.getElementById('monitoringToggle');
  const monitoringStatus = document.getElementById('monitoringStatus');
  const monitoringInterval = document.getElementById('monitoringInterval');
  const monitoringCountdown = document.getElementById('monitoringCountdown');

  // 获取排序设置元素
  const groupSortingMethod = document.getElementById('groupSortingMethod');
  const groupSortOrder = document.getElementById('groupSortOrder');
  const groupSortOrderIcon = document.getElementById('groupSortOrderIcon');
  const groupSortOrderText = document.getElementById('groupSortOrderText');
  const tabSortingMethod = document.getElementById('tabSortingMethod');
  const tabSortOrder = document.getElementById('tabSortOrder');
  const tabSortOrderIcon = document.getElementById('tabSortOrderIcon');
  const tabSortOrderText = document.getElementById('tabSortOrderText');

  // 排序信息显示元素在sorting-ui.js中处理

  // 初始化监控 UI
  initMonitoringUI(
    extensionActiveToggle, extensionActiveStatus,
    monitoringToggle, monitoringStatus,
    monitoringInterval, monitoringCountdown
  );

  // 初始化排序设置
  initSortingSettings(
    groupSortingMethod, groupSortOrder, groupSortOrderIcon, groupSortOrderText,
    tabSortingMethod, tabSortOrder, tabSortOrderIcon, tabSortOrderText,
    sortingMetricsElement, sortingMetricsContainer
  );

  // 加载标签组和排序指标
  loadTabGroups(groupListElement, noGroupsElement);
  loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer);

  // 添加刷新标签组按钮事件
  refreshGroupsButton.addEventListener('click', () => {
    console.log('刷新标签组按钮被点击');
    loadTabGroups(groupListElement, noGroupsElement);
    showStatus('标签组列表已刷新', 'info');
  });

  // 添加折叠所有标签组按钮事件
  collapseAllButton.addEventListener('click', () => {
    console.log('折叠所有标签组按钮被点击');
    // 获取所有标签组
    chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT }, async (groups) => {
      if (!groups || groups.length === 0) {
        showStatus('没有标签组可折叠', 'info');
        return;
      }

      // 折叠所有标签组
      for (const group of groups) {
        await chrome.tabGroups.update(group.id, { collapsed: true });
      }

      showStatus('所有标签组已折叠', 'info');
      loadTabGroups(groupListElement, noGroupsElement);
    });
  });

  // 添加展开所有标签组按钮事件
  expandAllButton.addEventListener('click', () => {
    console.log('展开所有标签组按钮被点击');
    // 获取所有标签组
    chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT }, async (groups) => {
      if (!groups || groups.length === 0) {
        showStatus('没有标签组可展开', 'info');
        return;
      }

      // 展开所有标签组
      for (const group of groups) {
        await chrome.tabGroups.update(group.id, { collapsed: false });
      }

      showStatus('所有标签组已展开', 'info');
      loadTabGroups(groupListElement, noGroupsElement);
    });
  });

  // 添加创建新标签组按钮事件
  createGroupButton.addEventListener('click', () => {
    console.log('创建新标签组按钮被点击');
    // 获取当前窗口的所有标签页
    chrome.tabs.query({ currentWindow: true, active: true }, async (tabs) => {
      if (tabs.length === 0) {
        showStatus('没有可用的标签页', 'error');
        return;
      }

      try {
        // 创建新的标签组
        const groupId = await chrome.tabs.group({ tabIds: [tabs[0].id] });

        // 设置组标题和颜色
        await chrome.tabGroups.update(groupId, {
          title: '新标签组',
          color: 'blue'
        });

        showStatus('新标签组已创建', 'success');
        loadTabGroups(groupListElement, noGroupsElement);
      } catch (error) {
        console.error('创建标签组失败:', error);
        showStatus('创建标签组失败: ' + error.message, 'error');
      }
    });
  });

  // 添加搜索功能
  searchButton.addEventListener('click', () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
      showStatus('请输入搜索关键词', 'info');
      return;
    }

    console.log('搜索标签页:', searchTerm);

    // 搜索标签页
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const matchedTabs = tabs.filter(tab =>
        tab.title.toLowerCase().includes(searchTerm) ||
        tab.url.toLowerCase().includes(searchTerm)
      );

      if (matchedTabs.length === 0) {
        showStatus('未找到匹配的标签页', 'info');
        return;
      }

      // 高亮显示第一个匹配的标签页
      chrome.tabs.update(matchedTabs[0].id, { active: true });

      showStatus(`找到 ${matchedTabs.length} 个匹配的标签页`, 'success');
    });
  });

  // 添加回车键搜索
  searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      searchButton.click();
    }
  });

  // 添加帮助按钮事件
  helpButton.addEventListener('click', () => {
    showStatus('标签页组织器帮助: 用于管理和组织浏览器标签页', 'info');
  });

  // 添加按域名分组按钮事件
  groupByDomainButton.addEventListener('click', () => {
    console.log('按域名分组按钮被点击');
    showStatus(getMessage('groupingTabs'), 'info');

    chrome.runtime.sendMessage({ action: 'groupByDomain' }, (response) => {
      console.log('groupByDomain 响应:', response);

      if (response && response.success) {
        // 监听分组完成消息
        chrome.runtime.onMessage.addListener(function listener(message) {
          if (message.action === 'groupByDomainComplete') {
            chrome.runtime.onMessage.removeListener(listener);

            if (message.success) {
              showStatus(getMessage('tabsGrouped'), 'success');
            } else {
              showStatus(getMessage('errorGroupingTabs', [message.error || 'Unknown error']), 'error');
            }

            // 重新加载标签组列表
            loadTabGroups(groupListElement, noGroupsElement);
          }
        });
      } else {
        showStatus(getMessage('errorGroupingTabs', [response ? response.error : 'Unknown error']), 'error');
      }
    });
  });

  // 添加取消所有分组按钮事件
  ungroupAllButton.addEventListener('click', () => {
    console.log('取消所有分组按钮被点击');
    showStatus(getMessage('ungroupingTabs'), 'info');

    chrome.runtime.sendMessage({ action: 'ungroupAll' }, (response) => {
      console.log('ungroupAll 响应:', response);

      if (response && response.success) {
        showStatus(getMessage('tabsUngrouped'), 'success');
        // 重新加载标签组列表
        loadTabGroups(groupListElement, noGroupsElement);
      } else {
        showStatus(getMessage('errorUngroupingTabs', [response ? response.error : 'Unknown error']), 'error');
      }
    });
  });

  // 添加标签组排序按钮事件
  sortTabGroupsButton.addEventListener('click', () => {
    console.log('标签组排序按钮被点击');
    showStatus(getMessage('sortingGroups'), 'info');

    chrome.runtime.sendMessage({ action: 'sortTabGroups' }, (response) => {
      console.log('sortTabGroups 响应:', response);

      if (response && response.success) {
        showStatus(getMessage('groupsSorted'), 'success');
        // 重新加载标签组列表
        loadTabGroups(groupListElement, noGroupsElement);
        // 重新加载排序指标
        loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer);
      } else {
        showStatus(getMessage('errorSortingGroups', [response ? response.error : 'Unknown error']), 'error');
      }
    });
  });

  // 添加组内标签排序按钮事件
  sortTabsButton.addEventListener('click', () => {
    console.log('对组内标签页排序按钮被点击');
    showStatus(getMessage('sortingTabs'), 'info');

    // 获取所有标签组
    chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT }, async (groups) => {
      console.log('查询到的标签组:', groups);
      try {
        if (!groups || groups.length === 0) {
          console.log('没有标签组可排序');
          showStatus(getMessage('noGroupsToSort'), 'info');
          return;
        }

        // 对每个组进行排序
        for (const group of groups) {
          console.log('正在对标签组内的标签排序:', group);
          const response = await chrome.runtime.sendMessage({
            action: 'sortTabsInGroup',
            groupId: group.id
          });
          console.log('sortTabsInGroup 响应:', response);
        }

        // 获取当前的排序方法和顺序
        const sortMethod = tabSortingMethod.options[tabSortingMethod.selectedIndex].text;
        const sortOrder = tabSortOrderText.textContent;

        showStatus(`所有标签组内的标签已按${sortMethod}${sortOrder}排序`, 'success');
        loadTabGroups(groupListElement, noGroupsElement);
        loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer);
      } catch (error) {
        console.error('排序标签页失败:', error);
        showStatus(getMessage('errorSortingTabs', [error.message || 'Unknown error']), 'error');
      }
    });
  });

  // 定期更新倒计时
  setInterval(() => {
    if (monitoringToggle.checked) {
      getNextExecutionTimeAndUpdateCountdown(monitoringCountdown);
    }
  }, 10000); // 每10秒更新一次
});

// 监听后台消息
chrome.runtime.onMessage.addListener((message) => {
  console.log('Popup received message:', message);

  // 处理消息
  if (message.action === 'groupByDomainComplete') {
    // 分组完成，重新加载标签组列表
    const groupListElement = document.getElementById('groupList');
    const noGroupsElement = document.getElementById('noGroups');
    loadTabGroups(groupListElement, noGroupsElement);
  }

  // 返回 true 表示异步处理
  return true;
});
