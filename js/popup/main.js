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
  const sortTabGroupsButton = document.getElementById('sortTabGroups');
  const sortTabsButton = document.getElementById('sortTabs');
  
  // 获取标签页切换元素
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
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

  // 添加标签页切换事件
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 移除所有标签页的激活状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 激活当前标签页
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
