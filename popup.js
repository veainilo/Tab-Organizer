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

  // Load current tab groups and sorting metrics
  loadTabGroups();
  loadSortingMetrics();

  // Add event listeners
  groupByDomainButton.addEventListener('click', () => {
    showStatus(getMessage('groupingTabs'), 'info');

    chrome.runtime.sendMessage({ action: 'groupByDomain' }, (response) => {
      if (response.success) {
        showStatus(getMessage('tabsGrouped'), 'success');
        loadTabGroups();
      } else {
        showStatus(getMessage('errorGroupingTabs', [response.error || 'Unknown error']), 'error');
      }
    });
  });

  ungroupAllButton.addEventListener('click', () => {
    showStatus(getMessage('ungroupingTabs'), 'info');

    chrome.runtime.sendMessage({ action: 'ungroupAll' }, (response) => {
      if (response.success) {
        showStatus(getMessage('tabsUngrouped'), 'success');
        loadTabGroups();
      } else {
        showStatus(getMessage('errorUngroupingTabs', [response.error || 'Unknown error']), 'error');
      }
    });
  });

  sortTabsButton.addEventListener('click', () => {
    showStatus(getMessage('sortingTabs'), 'info');

    // 获取所有标签组
    chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT }, async (groups) => {
      try {
        if (groups.length === 0) {
          showStatus(getMessage('noGroupsToSort'), 'info');
          return;
        }

        // 对每个组进行排序
        for (const group of groups) {
          await chrome.runtime.sendMessage({
            action: 'sortTabGroup',
            groupId: group.id
          });
        }

        showStatus(getMessage('tabsSorted'), 'success');
        loadTabGroups();
      } catch (error) {
        console.error('Error sorting tabs:', error);
        showStatus(getMessage('errorSortingTabs', [error.message || 'Unknown error']), 'error');
      }
    });
  });

  sortGroupsButton.addEventListener('click', () => {
    showStatus(getMessage('sortingGroups'), 'info');

    chrome.runtime.sendMessage({ action: 'sortTabGroups' }, (response) => {
      if (response && response.success) {
        showStatus(getMessage('groupsSorted'), 'success');
        loadTabGroups();
        // 排序后获取并显示排序指标
        loadSortingMetrics();
      } else {
        const error = response ? response.error : 'Unknown error';
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
    chrome.runtime.sendMessage({ action: 'getSortingMetrics' }, (response) => {
      console.log('getSortingMetrics response:', response);

      // 检查响应是否存在
      if (!response) {
        console.error('No response received from getSortingMetrics');
        const errorMsg = document.createElement('div');
        errorMsg.textContent = 'Error: No response from background script';
        sortingMetricsElement.innerHTML = '';
        sortingMetricsElement.appendChild(errorMsg);
        return;
      }

      if (response && response.success) {
        // 清空指标容器
        while (sortingMetricsElement.firstChild) {
          sortingMetricsElement.removeChild(sortingMetricsElement.firstChild);
        }

        const metrics = response.metrics;
        console.log('Metrics object:', metrics);
        console.log('Metrics keys:', Object.keys(metrics));

        const sortingMethod = response.sortingMethod;
        const sortAscending = response.sortAscending;
        console.log('Sorting method:', sortingMethod);
        console.log('Sort ascending:', sortAscending);

        // 如果没有指标数据，显示提示信息
        if (!metrics || Object.keys(metrics).length === 0) {
          console.log('No metrics data available, showing message');
          const noMetricsMsg = document.createElement('div');
          noMetricsMsg.textContent = getMessage('noSortingMetrics');
          sortingMetricsElement.appendChild(noMetricsMsg);
          return;
        }

        // 添加排序方法信息
        const methodInfo = document.createElement('div');
        methodInfo.className = 'metric-item';
        methodInfo.innerHTML = `<span class="metric-name">${getMessage('sortingMethodLabel')}:</span> <span class="metric-value">${getMessage('sortBy' + sortingMethod.charAt(0).toUpperCase() + sortingMethod.slice(1))}</span>`;
        sortingMetricsElement.appendChild(methodInfo);

        // 添加排序顺序信息
        const orderInfo = document.createElement('div');
        orderInfo.className = 'metric-item';
        orderInfo.innerHTML = `<span class="metric-name">${getMessage('sortingOrderLabel')}:</span> <span class="metric-value">${sortAscending ? getMessage('ascending') : getMessage('descending')}</span>`;
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
          groupTitle.style.backgroundColor = getGroupColorBackground(groupMetrics.color);
          groupTitle.style.color = getGroupColorText(groupMetrics.color);
          groupTitle.textContent = groupMetrics.title;
          sortingMetricsElement.appendChild(groupTitle);

          // 根据排序方法显示相应的指标
          switch (sortingMethod) {
            case 'title':
              addMetricItem(sortingMetricsElement, getMessage('titleLabel'), groupMetrics.title);
              break;

            case 'color':
              addMetricItem(sortingMetricsElement, getMessage('colorLabel'), getMessage(groupMetrics.color));
              addMetricItem(sortingMetricsElement, getMessage('colorOrderLabel'), groupMetrics.colorOrder);
              break;

            case 'size':
              addMetricItem(sortingMetricsElement, getMessage('sizeLabel'), groupMetrics.size);
              break;

            case 'createTime':
              addMetricItem(sortingMetricsElement, getMessage('createTimeLabel'), groupMetrics.createTimeFormatted);
              break;

            case 'lastAccessed':
              addMetricItem(sortingMetricsElement, getMessage('lastAccessedLabel'), groupMetrics.lastAccessTimeFormatted);
              break;

            case 'smart':
              // 添加智能排序的各项指标
              addMetricItem(sortingMetricsElement, getMessage('accessTimeLabel'), groupMetrics.accessTime ? new Date(groupMetrics.accessTime).toLocaleString() : 'N/A');
              addMetricItem(sortingMetricsElement, getMessage('accessScoreLabel'), groupMetrics.accessScore.toFixed(2), groupMetrics.accessWeight);

              addMetricItem(sortingMetricsElement, getMessage('sizeLabel'), groupMetrics.size);
              addMetricItem(sortingMetricsElement, getMessage('sizeScoreLabel'), groupMetrics.sizeScore.toFixed(2), groupMetrics.sizeWeight);

              addMetricItem(sortingMetricsElement, getMessage('createTimeLabel'), groupMetrics.createTime ? new Date(groupMetrics.createTime).toLocaleString() : 'N/A');
              addMetricItem(sortingMetricsElement, getMessage('createScoreLabel'), groupMetrics.createScore.toFixed(2), groupMetrics.createWeight);

              // 添加最终分数
              addMetricItem(sortingMetricsElement, getMessage('finalScoreLabel'), groupMetrics.finalScore.toFixed(2), 1.0);
              break;
          }
        }

        // 显示指标容器
        sortingMetricsContainer.style.display = 'block';
      } else {
        console.error('Error loading sorting metrics:', response ? response.error : 'Unknown error');
        // 显示错误信息
        sortingMetricsElement.innerHTML = '';
        const errorMsg = document.createElement('div');
        errorMsg.textContent = 'Error loading metrics: ' + (response ? response.error : 'Unknown error');
        sortingMetricsElement.appendChild(errorMsg);
      }
    });
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
    try {
      // Get all tab groups in the current window
      const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });

      // Clear the group list
      while (groupListElement.firstChild) {
        groupListElement.removeChild(groupListElement.firstChild);
      }

      if (groups.length === 0) {
        groupListElement.appendChild(noGroupsElement);
        return;
      }

      // Get all tabs to count tabs in each group
      const tabs = await chrome.tabs.query({ currentWindow: true });

      // Create a map of group IDs to tab counts
      const groupTabCounts = {};
      tabs.forEach(tab => {
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          groupTabCounts[tab.groupId] = (groupTabCounts[tab.groupId] || 0) + 1;
        }
      });

      // Add each group to the list
      groups.forEach(group => {
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
      console.error('Error loading tab groups:', error);
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
