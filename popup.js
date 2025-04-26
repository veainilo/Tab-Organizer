// Define constants
const TAB_GROUP_ID_NONE = -1;
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;

// Helper function to get localized message
function getMessage(messageName, substitutions) {
  return chrome.i18n.getMessage(messageName, substitutions);
}

// 本地化 UI 元素
function localizeUI() {
  // 本地化所有带有 data-i18n 属性的元素
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageName = element.getAttribute('data-i18n');
    element.textContent = getMessage(messageName);
  });

  // 本地化所有带有 data-i18n-placeholder 属性的输入元素
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const messageName = element.getAttribute('data-i18n-placeholder');
    element.placeholder = getMessage(messageName);
  });
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // 本地化 UI
  localizeUI();

  // Get UI elements
  const groupByDomainButton = document.getElementById('groupByDomain');
  const ungroupAllButton = document.getElementById('ungroupAll');
  const sortTabsButton = document.getElementById('sortTabs');
  const sortGroupsButton = document.getElementById('sortGroups');
  const statusElement = document.getElementById('status');
  const groupListElement = document.getElementById('groupList');
  const noGroupsElement = document.getElementById('noGroups');
  const sortingMetricsContainer = document.getElementById('sortingMetricsContainer');
  const sortingMetricsElement = document.getElementById('sortingMetrics');
  const extensionActiveToggle = document.getElementById('extensionActiveToggle');
  const extensionActiveStatus = document.getElementById('extensionActiveStatus');

  // 获取插件状态
  chrome.runtime.sendMessage({ action: 'getExtensionStatus' }, (response) => {
    console.log('getExtensionStatus 响应:', response);
    if (response && response.success) {
      // 设置开关状态
      extensionActiveToggle.checked = response.active;
      // 更新状态文本
      updateExtensionActiveStatus(response.active);
      // 根据插件状态启用或禁用取消分组按钮
      updateUngroupButtonState(response.active);
    }
  });

  // 添加开关事件监听器
  extensionActiveToggle.addEventListener('change', () => {
    const isActive = extensionActiveToggle.checked;
    console.log('插件激活状态切换:', isActive);

    chrome.runtime.sendMessage({
      action: 'toggleExtensionActive',
      active: isActive
    }, (response) => {
      console.log('toggleExtensionActive 响应:', response);
      if (response && response.success) {
        // 更新状态文本
        updateExtensionActiveStatus(response.active);
        // 根据插件状态启用或禁用取消分组按钮
        updateUngroupButtonState(response.active);

        // 如果激活了插件，自动刷新标签组列表
        if (response.active) {
          loadTabGroups();
        }
      }
    });
  });

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    console.log('收到来自 background 的消息:', message);

    // 处理分组完成消息
    if (message.action === 'groupByDomainComplete') {
      console.log('分组操作完成:', message);

      if (message.success) {
        showStatus(getMessage('tabsGrouped'), 'success');
        loadTabGroups();
      } else {
        const errorMsg = message.error || 'Unknown error';
        console.error('分组标签页失败:', errorMsg);
        showStatus(getMessage('errorGroupingTabs', [errorMsg]), 'error');
      }
    }

    // 必须返回 true 以保持消息通道开放
    return true;
  });

  // 更新插件激活状态文本
  function updateExtensionActiveStatus(isActive) {
    extensionActiveStatus.textContent = isActive ? '插件已激活' : '插件已停用';
    extensionActiveStatus.style.color = isActive ? '#0078d7' : '#999';
  }

  // 根据插件状态启用或禁用取消分组按钮
  function updateUngroupButtonState(isActive) {
    if (isActive) {
      ungroupAllButton.disabled = true;
      ungroupAllButton.style.opacity = '0.5';
      ungroupAllButton.title = '插件激活时不能取消分组';
    } else {
      ungroupAllButton.disabled = false;
      ungroupAllButton.style.opacity = '1';
      ungroupAllButton.title = '';
    }
  }

  // Load current tab groups and sorting metrics
  loadTabGroups();
  loadSortingMetrics();

  // Add event listeners
  groupByDomainButton.addEventListener('click', () => {
    console.log('按域名分组按钮被点击 - 开始处理');
    showStatus(getMessage('groupingTabs'), 'info');

    try {
      console.log('准备发送 groupByDomain 消息');
      chrome.runtime.sendMessage({ action: 'groupByDomain' }, (response) => {
        console.log('groupByDomain 初始响应收到:', response);

        if (chrome.runtime.lastError) {
          console.error('发送 groupByDomain 消息失败:', chrome.runtime.lastError);
          showStatus(getMessage('errorGroupingTabs', [chrome.runtime.lastError.message || 'Unknown error']), 'error');
          return;
        }

        if (response && response.success) {
          if (response.status === 'processing') {
            console.log('分组操作正在处理中，等待完成消息...');
            // 不需要做任何事情，等待 background 发送完成消息
          } else {
            console.log('分组立即完成，刷新标签组列表');
            showStatus(getMessage('tabsGrouped'), 'success');
            loadTabGroups();
          }
        } else {
          const errorMsg = response ? response.error : 'No response';
          console.error('分组标签页失败:', errorMsg);
          showStatus(getMessage('errorGroupingTabs', [errorMsg || 'Unknown error']), 'error');
        }
      });
      console.log('groupByDomain 消息已发送，等待响应');
    } catch (error) {
      console.error('发送 groupByDomain 消息时出错:', error);
      showStatus(getMessage('errorGroupingTabs', [error.message || 'Unknown error']), 'error');
    }
  });

  ungroupAllButton.addEventListener('click', () => {
    console.log('取消所有标签页分组按钮被点击');
    showStatus(getMessage('ungroupingTabs'), 'info');

    try {
      chrome.runtime.sendMessage({ action: 'ungroupAll' }, (response) => {
        console.log('ungroupAll 响应:', response);

        if (chrome.runtime.lastError) {
          console.error('发送 ungroupAll 消息失败:', chrome.runtime.lastError);
          showStatus(getMessage('errorUngroupingTabs', [chrome.runtime.lastError.message || 'Unknown error']), 'error');
          return;
        }

        if (response && response.success) {
          showStatus(getMessage('tabsUngrouped'), 'success');
          loadTabGroups();
        } else {
          const errorMsg = response ? response.error : 'No response';
          console.error('取消分组标签页失败:', errorMsg);
          showStatus(getMessage('errorUngroupingTabs', [errorMsg || 'Unknown error']), 'error');
        }
      });
    } catch (error) {
      console.error('发送 ungroupAll 消息时出错:', error);
      showStatus(getMessage('errorUngroupingTabs', [error.message || 'Unknown error']), 'error');
    }
  });

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
          console.log('正在对标签组排序:', group);
          const response = await chrome.runtime.sendMessage({
            action: 'sortTabGroup',
            groupId: group.id
          });
          console.log('sortTabGroup 响应:', response);
        }

        showStatus(getMessage('tabsSorted'), 'success');
        loadTabGroups();
      } catch (error) {
        console.error('排序标签页失败:', error);
        showStatus(getMessage('errorSortingTabs', [error.message || 'Unknown error']), 'error');
      }
    });
  });

  sortGroupsButton.addEventListener('click', () => {
    console.log('对标签组排序按钮被点击');
    showStatus(getMessage('sortingGroups'), 'info');

    chrome.runtime.sendMessage({ action: 'sortTabGroups' }, (response) => {
      console.log('sortTabGroups 响应:', response);
      if (response && response.success) {
        showStatus(getMessage('groupsSorted'), 'success');
        loadTabGroups();
        // 排序后获取并显示排序指标
        loadSortingMetrics();
      } else {
        const error = response ? response.error : 'No response';
        console.error('排序标签组失败:', error);
        showStatus(getMessage('errorSortingGroups', [error]), 'error');
      }
    });
  });

  // 排序指标现在默认显示，不需要按钮事件

  // Function to show status messages
  function showStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status';

    if (type === 'success') {
      statusElement.classList.add('success');
    } else if (type === 'error') {
      statusElement.classList.add('error');
    }

    statusElement.style.display = 'block';

    // Hide status after 3 seconds
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }

  // 加载并显示排序指标数据
  function loadSortingMetrics() {
    console.log('loadSortingMetrics function called');

    // 清空指标容器
    while (sortingMetricsElement.firstChild) {
      sortingMetricsElement.removeChild(sortingMetricsElement.firstChild);
    }

    // 显示加载中消息
    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Loading metrics...';
    sortingMetricsElement.appendChild(loadingMsg);

    try {
      chrome.runtime.sendMessage({ action: 'getSortingMetrics' }, (response) => {
        console.log('getSortingMetrics response:', response);

        // 清空指标容器
        while (sortingMetricsElement.firstChild) {
          sortingMetricsElement.removeChild(sortingMetricsElement.firstChild);
        }

        // 检查是否有运行时错误
        if (chrome.runtime.lastError) {
          console.error('发送 getSortingMetrics 消息失败:', chrome.runtime.lastError);
          const errorMsg = document.createElement('div');
          errorMsg.textContent = 'Error: ' + (chrome.runtime.lastError.message || 'Unknown error');
          sortingMetricsElement.appendChild(errorMsg);
          return;
        }

        // 检查响应是否存在
        if (!response) {
          console.error('No response received from getSortingMetrics');
          const errorMsg = document.createElement('div');
          errorMsg.textContent = 'Error: No response from background script';
          sortingMetricsElement.appendChild(errorMsg);
          return;
        }

        // 检查响应是否成功
        if (!response.success) {
          console.error('Error loading sorting metrics:', response.error || 'Unknown error');
          const errorMsg = document.createElement('div');
          errorMsg.textContent = 'Error: ' + (response.error || 'Unknown error');
          sortingMetricsElement.appendChild(errorMsg);
          return;
        }

        // 获取指标数据
        const metrics = response.metrics || {};
        console.log('Metrics object:', metrics);
        console.log('Metrics keys:', Object.keys(metrics));

        // 获取排序方法和排序顺序
        const sortingMethod = response.sortingMethod || 'title';
        const sortAscending = response.sortAscending !== undefined ? response.sortAscending : true;
        console.log('Sorting method:', sortingMethod);
        console.log('Sort ascending:', sortAscending);

        // 如果没有指标数据，显示提示信息
        if (Object.keys(metrics).length === 0) {
          console.log('No metrics data available, showing message');
          const noMetricsMsg = document.createElement('div');
          noMetricsMsg.textContent = 'No sorting metrics available';
          sortingMetricsElement.appendChild(noMetricsMsg);
          return;
        }

        // 添加排序方法信息
        const methodInfo = document.createElement('div');
        methodInfo.className = 'metric-item';
        methodInfo.innerHTML = `<span class="metric-name">Sorting method:</span> <span class="metric-value">${sortingMethod}</span>`;
        sortingMetricsElement.appendChild(methodInfo);

        // 添加排序顺序信息
        const orderInfo = document.createElement('div');
        orderInfo.className = 'metric-item';
        orderInfo.innerHTML = `<span class="metric-name">Sorting order:</span> <span class="metric-value">${sortAscending ? 'Ascending' : 'Descending'}</span>`;
        sortingMetricsElement.appendChild(orderInfo);

        // 添加分隔线
        const divider = document.createElement('hr');
        divider.style.margin = '10px 0';
        divider.style.border = 'none';
        divider.style.borderTop = '1px solid #e1e1e1';
        sortingMetricsElement.appendChild(divider);

        // 为每个标签组添加指标数据
        for (const groupId in metrics) {
          const groupMetrics = metrics[groupId];

          // 创建标签组标题
          const groupTitle = document.createElement('div');
          groupTitle.className = 'metric-group-title';
          groupTitle.style.fontWeight = 'bold';
          groupTitle.style.marginTop = '10px';
          groupTitle.style.marginBottom = '5px';
          groupTitle.style.padding = '3px 5px';
          groupTitle.style.borderRadius = '3px';
          groupTitle.style.backgroundColor = getGroupColorBackground(groupMetrics.color || 'grey');
          groupTitle.style.color = getGroupColorText(groupMetrics.color || 'grey');
          groupTitle.textContent = groupMetrics.title || 'Unnamed Group';
          sortingMetricsElement.appendChild(groupTitle);

          // 根据排序方法显示相应的指标
          if (sortingMethod === 'smart') {
            // 添加智能排序的各项指标
            addMetricItem(sortingMetricsElement, 'Access Time', groupMetrics.accessTimeFormatted || 'N/A');
            addMetricItem(sortingMetricsElement, 'Access Score', groupMetrics.accessScore ? groupMetrics.accessScore.toFixed(2) : 'N/A', groupMetrics.accessWeight);

            addMetricItem(sortingMetricsElement, 'Size', groupMetrics.size || 'N/A');
            addMetricItem(sortingMetricsElement, 'Size Score', groupMetrics.sizeScore ? groupMetrics.sizeScore.toFixed(2) : 'N/A', groupMetrics.sizeWeight);

            addMetricItem(sortingMetricsElement, 'Create Time', groupMetrics.createTimeFormatted || 'N/A');
            addMetricItem(sortingMetricsElement, 'Create Score', groupMetrics.createScore ? groupMetrics.createScore.toFixed(2) : 'N/A', groupMetrics.createWeight);

            // 添加最终分数
            addMetricItem(sortingMetricsElement, 'Final Score', groupMetrics.finalScore ? groupMetrics.finalScore.toFixed(2) : 'N/A');
          } else {
            // 添加排序值
            addMetricItem(sortingMetricsElement, 'Sort Value', groupMetrics.sortValue || 'N/A');
          }
        }

        // 显示指标容器
        sortingMetricsContainer.style.display = 'block';
      });
    } catch (error) {
      console.error('发送 getSortingMetrics 消息时出错:', error);

      // 清空指标容器
      while (sortingMetricsElement.firstChild) {
        sortingMetricsElement.removeChild(sortingMetricsElement.firstChild);
      }

      const errorMsg = document.createElement('div');
      errorMsg.textContent = 'Error: ' + (error.message || 'Unknown error');
      sortingMetricsElement.appendChild(errorMsg);
    }
  }

  // 添加指标项
  function addMetricItem(container, name, value, weight) {
    const item = document.createElement('div');
    item.className = 'metric-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'metric-name';
    nameSpan.textContent = name;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'metric-value';
    valueSpan.textContent = value;

    item.appendChild(nameSpan);
    item.appendChild(valueSpan);

    // 如果提供了权重，添加进度条
    if (weight !== undefined) {
      const barContainer = document.createElement('div');
      barContainer.className = 'metric-bar-container';

      const bar = document.createElement('div');
      bar.className = 'metric-bar';
      bar.style.width = `${weight * 100}%`;

      barContainer.appendChild(bar);
      item.appendChild(barContainer);
    }

    container.appendChild(item);
  }

  // Function to load and display current tab groups
  async function loadTabGroups() {
    console.log('加载标签组列表');
    try {
      // Get all tab groups in the current window
      const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
      console.log('查询到的标签组:', groups);

      // Clear the group list
      while (groupListElement.firstChild) {
        groupListElement.removeChild(groupListElement.firstChild);
      }

      if (!groups || groups.length === 0) {
        console.log('没有标签组，显示提示信息');
        groupListElement.appendChild(noGroupsElement);
        return;
      }

      // Get all tabs to count tabs in each group
      const tabs = await chrome.tabs.query({ currentWindow: true });
      console.log('查询到的标签页:', tabs);

      // Create a map of group IDs to tab counts
      const groupTabCounts = {};
      tabs.forEach(tab => {
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          groupTabCounts[tab.groupId] = (groupTabCounts[tab.groupId] || 0) + 1;
        }
      });
      console.log('标签组计数:', groupTabCounts);

      // Add each group to the list
      groups.forEach(group => {
        console.log('添加标签组到列表:', group);
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        groupItem.style.backgroundColor = getGroupColorBackground(group.color);
        groupItem.style.color = getGroupColorText(group.color);

        const groupTitle = document.createElement('span');
        groupTitle.className = 'group-title';
        groupTitle.textContent = group.title || getMessage('unnamedGroup');
        if (!group.title) {
          groupTitle.setAttribute('data-i18n', 'unnamedGroup');
        }

        const groupCount = document.createElement('span');
        groupCount.className = 'group-count';
        groupCount.textContent = groupTabCounts[group.id] || 0;

        groupItem.appendChild(groupTitle);
        groupItem.appendChild(groupCount);

        groupListElement.appendChild(groupItem);
      });
    } catch (error) {
      console.error('加载标签组失败:', error);
      showStatus(getMessage('errorLoadingGroups'), 'error');
    }
  }

  // Helper function to get background color for group
  function getGroupColorBackground(color) {
    // 检查是否在指标视图中
    const inMetricsView = document.getElementById('sortingMetricsContainer') &&
                         document.getElementById('sortingMetricsContainer').style.display !== 'none';

    // 在列表视图中使用浅色背景
    if (!inMetricsView) {
      const colors = {
        'grey': '#f1f3f4',
        'blue': '#d0e8ff',
        'red': '#ffd0d0',
        'yellow': '#fff8d0',
        'green': '#d0ffd0',
        'pink': '#ffd0f0',
        'purple': '#e8d0ff',
        'cyan': '#d0ffff',
        'orange': '#ffecd0'
      };
      return colors[color] || '#f1f3f4';
    }
    // 在指标视图中使用深色背景
    else {
      const colors = {
        'grey': '#bdc1c6',
        'blue': '#8ab4f8',
        'red': '#f28b82',
        'yellow': '#fdd663',
        'green': '#81c995',
        'pink': '#ff8bcb',
        'purple': '#d7aefb',
        'cyan': '#78d9ec',
        'orange': '#fcad70'
      };
      return colors[color] || '#bdc1c6';
    }
  }

  // Helper function to get text color for group
  function getGroupColorText(color) {
    // 检查是否在指标视图中
    const inMetricsView = document.getElementById('sortingMetricsContainer') &&
                         document.getElementById('sortingMetricsContainer').style.display !== 'none';

    // 在列表视图中使用深色文本
    if (!inMetricsView) {
      const colors = {
        'grey': '#444444',
        'blue': '#0046b5',
        'red': '#b50000',
        'yellow': '#b57700',
        'green': '#00b500',
        'pink': '#b5007a',
        'purple': '#7a00b5',
        'cyan': '#00b5b5',
        'orange': '#b56a00'
      };
      return colors[color] || '#444444';
    }
    // 在指标视图中使用浅色/深色文本
    else {
      const darkTextColors = ['yellow', 'green', 'cyan'];
      return darkTextColors.includes(color) ? '#202124' : '#ffffff';
    }
  }
});
