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
  const monitoringToggle = document.getElementById('monitoringToggle');
  const monitoringStatus = document.getElementById('monitoringStatus');

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

      // 设置监控开关状态
      if (response.settings && response.settings.monitoringEnabled !== undefined) {
        monitoringToggle.checked = response.settings.monitoringEnabled;
        updateMonitoringStatus(response.settings.monitoringEnabled);
      }
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

  // 添加监控开关事件监听器
  monitoringToggle.addEventListener('change', () => {
    const isEnabled = monitoringToggle.checked;
    console.log('持续监控状态切换:', isEnabled);

    chrome.runtime.sendMessage({
      action: 'toggleMonitoring',
      enabled: isEnabled
    }, (response) => {
      console.log('toggleMonitoring 响应:', response);
      if (response && response.success) {
        // 更新状态文本
        updateMonitoringStatus(response.monitoringEnabled);
      }
    });
  });

  // 更新插件激活状态文本和指示器
  function updateExtensionActiveStatus(isActive) {
    const extensionActiveIndicator = document.getElementById('extensionActiveIndicator');
    extensionActiveStatus.textContent = isActive ? '插件已激活' : '插件已停用';
    extensionActiveStatus.style.color = isActive ? '#0078d7' : '#666';

    if (extensionActiveIndicator) {
      extensionActiveIndicator.className = isActive ?
        'status-indicator status-active' :
        'status-indicator status-inactive';
    }
  }

  // 更新监控状态文本和指示器
  function updateMonitoringStatus(isEnabled) {
    const monitoringIndicator = document.getElementById('monitoringIndicator');
    monitoringStatus.textContent = isEnabled ? '持续监控已启用' : '持续监控已停用';
    monitoringStatus.style.color = isEnabled ? '#0078d7' : '#666';

    if (monitoringIndicator) {
      monitoringIndicator.className = isEnabled ?
        'status-indicator status-active' :
        'status-indicator status-inactive';
    }
  }

  // 设置标签切换功能
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // 移除所有标签按钮的active类
      tabButtons.forEach(btn => btn.classList.remove('active'));

      // 移除所有标签内容的active类
      tabContents.forEach(content => content.classList.remove('active'));

      // 添加当前标签按钮的active类
      button.classList.add('active');

      // 添加当前标签内容的active类
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });

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

          // 创建标签组指标容器
          const metricsGroup = document.createElement('div');
          metricsGroup.className = 'metrics-group';

          // 创建标签组标题
          const groupTitle = document.createElement('div');
          groupTitle.className = 'metric-group-title';
          groupTitle.style.fontWeight = 'bold';
          groupTitle.style.marginBottom = '10px';
          groupTitle.style.padding = '5px 8px';
          groupTitle.style.borderRadius = '4px';
          groupTitle.style.backgroundColor = getGroupColorBackground(groupMetrics.color || 'grey');
          groupTitle.style.color = getGroupColorText(groupMetrics.color || 'grey');
          groupTitle.style.display = 'flex';
          groupTitle.style.alignItems = 'center';

          // 添加图标
          const titleIcon = document.createElement('span');
          titleIcon.style.marginRight = '8px';
          titleIcon.innerHTML = '&#128196;'; // 文档图标
          groupTitle.appendChild(titleIcon);

          // 添加标题文本
          const titleText = document.createElement('span');
          titleText.textContent = groupMetrics.title || 'Unnamed Group';
          groupTitle.appendChild(titleText);

          // 添加标签数量
          if (groupMetrics.size) {
            const sizeIndicator = document.createElement('span');
            sizeIndicator.style.marginLeft = 'auto';
            sizeIndicator.style.backgroundColor = 'rgba(255,255,255,0.3)';
            sizeIndicator.style.padding = '2px 6px';
            sizeIndicator.style.borderRadius = '10px';
            sizeIndicator.style.fontSize = '12px';
            sizeIndicator.textContent = `${groupMetrics.size} 标签`;
            groupTitle.appendChild(sizeIndicator);
          }

          metricsGroup.appendChild(groupTitle);

          // 根据排序方法显示相应的指标
          if (sortingMethod === 'smart') {
            // 创建指标容器
            const metricsContainer = document.createElement('div');
            metricsContainer.style.padding = '0 5px';

            // 添加智能排序的各项指标
            addMetricItem(metricsContainer, '最近访问', groupMetrics.accessTimeFormatted || 'N/A', null, '🕒');
            addMetricItem(metricsContainer, '访问评分', groupMetrics.accessScore ? groupMetrics.accessScore.toFixed(2) : 'N/A', groupMetrics.accessWeight, '📈');

            addMetricItem(metricsContainer, '标签数量', groupMetrics.size || 'N/A', null, '📑');
            addMetricItem(metricsContainer, '大小评分', groupMetrics.sizeScore ? groupMetrics.sizeScore.toFixed(2) : 'N/A', groupMetrics.sizeWeight, '📏');

            addMetricItem(metricsContainer, '创建时间', groupMetrics.createTimeFormatted || 'N/A', null, '📅');
            addMetricItem(metricsContainer, '创建评分', groupMetrics.createScore ? groupMetrics.createScore.toFixed(2) : 'N/A', groupMetrics.createWeight, '🔍');

            // 添加最终分数
            const finalScoreItem = document.createElement('div');
            finalScoreItem.className = 'metric-item';
            finalScoreItem.style.marginTop = '10px';
            finalScoreItem.style.borderTop = '1px dashed #ddd';
            finalScoreItem.style.paddingTop = '10px';

            const finalScoreName = document.createElement('span');
            finalScoreName.className = 'metric-name';
            finalScoreName.innerHTML = '<i>🏆</i> 最终评分';

            const finalScoreValue = document.createElement('span');
            finalScoreValue.className = 'metric-value metric-score';
            finalScoreValue.textContent = groupMetrics.finalScore ? groupMetrics.finalScore.toFixed(2) : 'N/A';

            finalScoreItem.appendChild(finalScoreName);
            finalScoreItem.appendChild(finalScoreValue);
            metricsContainer.appendChild(finalScoreItem);

            metricsGroup.appendChild(metricsContainer);
          } else {
            // 创建指标容器
            const metricsContainer = document.createElement('div');
            metricsContainer.style.padding = '0 5px';

            // 添加排序值
            addMetricItem(metricsContainer, '排序值', groupMetrics.sortValue || 'N/A', null, '🔢');

            metricsGroup.appendChild(metricsContainer);
          }

          sortingMetricsElement.appendChild(metricsGroup);
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
  function addMetricItem(container, name, value, weight, icon) {
    const item = document.createElement('div');
    item.className = 'metric-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'metric-name';

    // 如果提供了图标，添加图标
    if (icon) {
      const iconElement = document.createElement('i');
      iconElement.innerHTML = icon;
      nameSpan.appendChild(iconElement);
    }

    // 添加名称文本
    const nameText = document.createTextNode(name);
    nameSpan.appendChild(nameText);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'metric-value';

    // 如果是评分值，添加特殊样式
    if (name.toLowerCase().includes('评分') || name.toLowerCase().includes('score')) {
      valueSpan.classList.add('metric-score');
    }

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

      // Get all tabs to count tabs in each group and determine their order
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

      // 获取标签组的顺序
      // 首先，找出每个组的第一个标签页的索引
      const groupFirstTabIndex = {};
      for (const group of groups) {
        const groupTabs = tabs.filter(tab => tab.groupId === group.id);
        if (groupTabs.length > 0) {
          // 找出组内索引最小的标签页
          const minIndexTab = groupTabs.reduce((min, tab) =>
            tab.index < min.index ? tab : min, groupTabs[0]);
          groupFirstTabIndex[group.id] = minIndexTab.index;
        } else {
          groupFirstTabIndex[group.id] = Infinity; // 没有标签页的组放在最后
        }
      }

      // 根据第一个标签页的索引对组进行排序
      const sortedGroups = [...groups].sort((a, b) =>
        groupFirstTabIndex[a.id] - groupFirstTabIndex[b.id]);

      // 添加标题行，显示排序顺序
      const headerRow = document.createElement('div');
      headerRow.className = 'group-header';
      headerRow.innerHTML = `
        <div class="group-header-title">标签组名称</div>
        <div class="group-header-info">
          <span>标签数</span>
          <span>排序</span>
          <span>操作</span>
        </div>
      `;
      groupListElement.appendChild(headerRow);

      // Add each group to the list in the sorted order
      sortedGroups.forEach((group, index) => {
        console.log('添加标签组到列表:', group, '顺序:', index + 1);
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';

        // 创建左侧标题区域
        const titleContainer = document.createElement('div');
        titleContainer.className = 'group-title';

        // 添加排序序号
        const orderBadge = document.createElement('span');
        orderBadge.className = 'order-badge';
        orderBadge.textContent = (index + 1).toString();
        orderBadge.style.backgroundColor = getGroupColorBackground(group.color);
        orderBadge.style.color = getGroupColorText(group.color);
        titleContainer.appendChild(orderBadge);

        // 添加图标
        const groupIcon = document.createElement('span');
        groupIcon.className = 'group-icon';
        groupIcon.style.color = getGroupColorText(group.color);
        groupIcon.innerHTML = '&#128196;'; // 文档图标
        titleContainer.appendChild(groupIcon);

        // 添加标题文本
        const titleText = document.createElement('span');
        titleText.textContent = group.title || getMessage('unnamedGroup');
        if (!group.title) {
          titleText.setAttribute('data-i18n', 'unnamedGroup');
        }
        titleContainer.appendChild(titleText);

        // 创建右侧区域
        const rightContainer = document.createElement('div');
        rightContainer.style.display = 'flex';
        rightContainer.style.alignItems = 'center';
        rightContainer.style.gap = '10px';

        // 添加标签数量
        const groupCount = document.createElement('span');
        groupCount.className = 'group-count';
        groupCount.textContent = groupTabCounts[group.id] || 0;
        rightContainer.appendChild(groupCount);

        // 添加排序指标
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator';
        sortIndicator.title = '当前排序位置';
        sortIndicator.textContent = `#${index + 1}`;
        rightContainer.appendChild(sortIndicator);

        // 添加操作按钮
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'group-actions';

        // 添加排序按钮
        const sortButton = document.createElement('button');
        sortButton.className = 'group-action-button';
        sortButton.title = '排序此组内的标签';
        sortButton.innerHTML = '&#128260;'; // 排序图标
        sortButton.addEventListener('click', (e) => {
          e.stopPropagation(); // 阻止事件冒泡
          sortTabGroup(group.id);
        });
        actionsContainer.appendChild(sortButton);

        rightContainer.appendChild(actionsContainer);

        // 添加到组项
        groupItem.appendChild(titleContainer);
        groupItem.appendChild(rightContainer);

        // 设置组项的边框颜色
        groupItem.style.borderLeft = `4px solid ${getGroupColorBackground(group.color)}`;

        // 添加点击事件
        groupItem.addEventListener('click', () => {
          // 可以添加点击组时的操作，例如聚焦到该组
          console.log('点击了标签组:', group.title);

          // 聚焦到该组的第一个标签页
          const groupTabs = tabs.filter(tab => tab.groupId === group.id);
          if (groupTabs.length > 0) {
            chrome.tabs.update(groupTabs[0].id, { active: true });
          }
        });

        groupListElement.appendChild(groupItem);
      });

      // 辅助函数：排序特定标签组
      async function sortTabGroup(groupId) {
        try {
          showStatus('正在排序标签组...', 'info');
          const response = await chrome.runtime.sendMessage({
            action: 'sortTabGroup',
            groupId: groupId
          });

          if (response && response.success) {
            showStatus('标签组排序完成', 'success');
            loadTabGroups(); // 重新加载标签组列表
          } else {
            showStatus('标签组排序失败', 'error');
          }
        } catch (error) {
          console.error('排序标签组失败:', error);
          showStatus('标签组排序失败: ' + error.message, 'error');
        }
      }
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
