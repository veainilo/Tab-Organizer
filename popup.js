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
  const monitoringInterval = document.getElementById('monitoringInterval');

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

      // 设置监控间隔
      if (response.settings && response.settings.autoGroupInterval !== undefined) {
        monitoringInterval.value = response.settings.autoGroupInterval;
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

  // 添加监控间隔输入框事件监听器
  monitoringInterval.addEventListener('change', () => {
    let interval = parseInt(monitoringInterval.value);

    // 确保间隔至少为1000毫秒
    if (isNaN(interval) || interval < 1000) {
      interval = 1000;
      monitoringInterval.value = interval;
    }

    console.log('监控间隔更改:', interval);

    chrome.runtime.sendMessage({
      action: 'updateMonitoringInterval',
      interval: interval
    }, (response) => {
      console.log('updateMonitoringInterval 响应:', response);
      if (response && response.success) {
        showStatus('监控间隔已更新', 'success');
      } else {
        showStatus('更新监控间隔失败', 'error');
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

  // 保存标签组展开状态的对象
  const groupExpandStates = {};

  // Function to load and display current tab groups
  async function loadTabGroups() {
    console.log('加载标签组列表');
    try {
      // 保存当前展开状态（如果有）
      const expandButtons = document.querySelectorAll('.expand-button');
      expandButtons.forEach(button => {
        const groupId = button.dataset.groupId;
        if (groupId) {
          groupExpandStates[groupId] = button.dataset.expanded === 'true';
        }
      });

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

      // 获取排序指标数据
      let sortingMetrics = {};
      try {
        const metricsResponse = await chrome.runtime.sendMessage({ action: 'getSortingMetrics' });
        if (metricsResponse && metricsResponse.success) {
          sortingMetrics = metricsResponse.metrics || {};
        }
      } catch (error) {
        console.error('获取排序指标失败:', error);
      }

      // 获取当前排序方法和排序顺序
      let currentSortMethod = 'position'; // 默认按位置排序
      let sortAscending = true; // 默认升序

      try {
        const statusResponse = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });
        if (statusResponse && statusResponse.success && statusResponse.settings) {
          currentSortMethod = statusResponse.settings.groupSortingMethod || 'position';
          sortAscending = statusResponse.settings.groupSortAscending !== false;
        }
      } catch (error) {
        console.error('获取扩展状态失败:', error);
      }

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

      // 计算每个组的排序分数
      const groupScores = {};
      for (const group of groups) {
        // 默认使用位置作为分数
        let score = groupFirstTabIndex[group.id];

        // 如果有排序指标数据，使用指标数据
        if (sortingMetrics[group.id]) {
          const metrics = sortingMetrics[group.id];

          if (currentSortMethod === 'title') {
            score = metrics.title || '';
          } else if (currentSortMethod === 'size') {
            score = metrics.size || 0;
          } else if (currentSortMethod === 'smart') {
            score = metrics.finalScore || 0;
          }
        }

        groupScores[group.id] = score;
      }

      // 根据分数对组进行排序
      const sortedGroups = [...groups].sort((a, b) => {
        const scoreA = groupScores[a.id];
        const scoreB = groupScores[b.id];

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

      // 添加标题行，显示排序顺序和排序控制
      const headerRow = document.createElement('div');
      headerRow.className = 'group-header';

      // 创建排序方法选择器
      const sortMethodSelector = document.createElement('select');
      sortMethodSelector.className = 'sort-method-selector';
      sortMethodSelector.innerHTML = `
        <option value="position" ${currentSortMethod === 'position' ? 'selected' : ''}>按位置</option>
        <option value="title" ${currentSortMethod === 'title' ? 'selected' : ''}>按标题</option>
        <option value="size" ${currentSortMethod === 'size' ? 'selected' : ''}>按大小</option>
        <option value="smart" ${currentSortMethod === 'smart' ? 'selected' : ''}>智能排序</option>
      `;

      // 创建排序顺序切换按钮
      const sortOrderToggle = document.createElement('button');
      sortOrderToggle.className = 'sort-order-toggle';
      sortOrderToggle.innerHTML = sortAscending ? '↑ 升序' : '↓ 降序';
      sortOrderToggle.title = sortAscending ? '点击切换为降序' : '点击切换为升序';

      // 添加排序方法选择器的事件监听器
      sortMethodSelector.addEventListener('change', () => {
        const newMethod = sortMethodSelector.value;
        chrome.runtime.sendMessage({
          action: 'updateSortingMethod',
          method: newMethod
        }, (response) => {
          if (response && response.success) {
            loadTabGroups(); // 重新加载标签组列表
          }
        });
      });

      // 添加排序顺序切换按钮的事件监听器
      sortOrderToggle.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          action: 'toggleSortOrder'
        }, (response) => {
          if (response && response.success) {
            loadTabGroups(); // 重新加载标签组列表
          }
        });
      });

      // 创建排序控制容器
      const sortControls = document.createElement('div');
      sortControls.className = 'sort-controls';
      sortControls.appendChild(sortMethodSelector);
      sortControls.appendChild(sortOrderToggle);

      // 创建标题行内容
      const headerTitle = document.createElement('div');
      headerTitle.className = 'group-header-title';
      headerTitle.textContent = '标签组名称';

      const headerInfo = document.createElement('div');
      headerInfo.className = 'group-header-info';
      headerInfo.innerHTML = `
        <span>标签数</span>
        <span>评分</span>
        <span>操作</span>
      `;

      headerRow.appendChild(headerTitle);
      headerRow.appendChild(headerInfo);

      // 添加排序控制行
      const sortControlRow = document.createElement('div');
      sortControlRow.className = 'sort-control-row';
      sortControlRow.appendChild(sortControls);

      // 创建快速操作行
      const quickActionsRow = document.createElement('div');
      quickActionsRow.className = 'quick-actions-row';

      // 创建展开所有按钮
      const expandAllButton = document.createElement('button');
      expandAllButton.className = 'quick-action-button';
      expandAllButton.title = '展开所有标签组';
      expandAllButton.innerHTML = '&#9660; 展开所有';
      expandAllButton.addEventListener('click', () => {
        const expandButtons = document.querySelectorAll('.expand-button');
        expandButtons.forEach(button => {
          if (button.dataset.expanded !== 'true') {
            button.click(); // 触发展开
          }
        });
      });

      // 创建折叠所有按钮
      const collapseAllButton = document.createElement('button');
      collapseAllButton.className = 'quick-action-button';
      collapseAllButton.title = '折叠所有标签组';
      collapseAllButton.innerHTML = '&#9650; 折叠所有';
      collapseAllButton.addEventListener('click', () => {
        const expandButtons = document.querySelectorAll('.expand-button');
        expandButtons.forEach(button => {
          if (button.dataset.expanded === 'true') {
            button.click(); // 触发折叠
          }
        });
      });

      // 创建排序所有按钮
      const sortAllButton = document.createElement('button');
      sortAllButton.className = 'quick-action-button';
      sortAllButton.title = '排序所有标签组';
      sortAllButton.innerHTML = '&#128260; 排序所有';
      sortAllButton.addEventListener('click', () => {
        sortAllTabGroups();
      });

      // 添加按钮到快速操作行
      quickActionsRow.appendChild(expandAllButton);
      quickActionsRow.appendChild(collapseAllButton);
      quickActionsRow.appendChild(sortAllButton);

      // 添加标题行、排序控制行和快速操作行
      groupListElement.appendChild(headerRow);
      groupListElement.appendChild(sortControlRow);
      groupListElement.appendChild(quickActionsRow);

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

        // 添加排序评分
        const scoreIndicator = document.createElement('span');
        scoreIndicator.className = 'score-indicator';

        // 获取排序评分
        let scoreText = `#${index + 1}`;
        let scoreTitle = '当前排序位置';

        if (sortingMetrics[group.id]) {
          const metrics = sortingMetrics[group.id];

          if (currentSortMethod === 'title') {
            scoreText = metrics.title || '';
            scoreTitle = '标题';
          } else if (currentSortMethod === 'size') {
            scoreText = metrics.size || '0';
            scoreTitle = '标签数量';
          } else if (currentSortMethod === 'smart') {
            scoreText = metrics.finalScore ? metrics.finalScore.toFixed(2) : '0';
            scoreTitle = '智能排序评分';
          }
        }

        scoreIndicator.textContent = scoreText;
        scoreIndicator.title = `${scoreTitle}: ${scoreText}`;
        rightContainer.appendChild(scoreIndicator);

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

          // 显示排序中的提示
          sortButton.disabled = true;
          sortButton.innerHTML = '&#8987;'; // 沙漏图标

          // 调用后台脚本排序标签组内的标签
          chrome.runtime.sendMessage({
            action: 'sortTabsInGroup',
            groupId: group.id
          }, (response) => {
            // 恢复按钮状态
            sortButton.disabled = false;
            sortButton.innerHTML = '&#128260;'; // 排序图标

            if (response && response.success) {
              // 排序成功，重新加载标签组列表
              loadTabGroups();
            } else {
              console.error('排序标签失败:', response ? response.error : '未知错误');
            }
          });
        });
        actionsContainer.appendChild(sortButton);

        rightContainer.appendChild(actionsContainer);

        // 添加到组项
        groupItem.appendChild(titleContainer);
        groupItem.appendChild(rightContainer);

        // 设置组项的边框颜色
        groupItem.style.borderLeft = `4px solid ${getGroupColorBackground(group.color)}`;

        // 创建展开/折叠按钮
        const expandButton = document.createElement('button');
        expandButton.className = 'group-action-button expand-button';
        expandButton.title = '展开/折叠标签列表';
        expandButton.dataset.groupId = group.id.toString();

        // 恢复之前的展开状态（如果有）
        const wasExpanded = groupExpandStates[group.id.toString()] || false;
        expandButton.dataset.expanded = wasExpanded.toString();
        expandButton.innerHTML = wasExpanded ? '&#9650;' : '&#9660;'; // 向上或向下箭头

        actionsContainer.appendChild(expandButton);

        // 创建标签列表容器
        const tabListContainer = document.createElement('div');
        tabListContainer.className = 'tab-list-container';
        tabListContainer.style.display = wasExpanded ? 'block' : 'none';

        // 获取组内标签页
        const groupTabs = tabs.filter(tab => tab.groupId === group.id);

        // 获取标签排序指标
        let tabSortingMetrics = {};

        try {
          // 尝试从后台获取标签排序指标
          if (sortingMetrics[group.id] && sortingMetrics[group.id].tabs) {
            tabSortingMetrics = sortingMetrics[group.id].tabs;
            console.log(`从后台获取到标签组 ${group.id} 的标签排序指标:`, tabSortingMetrics);
          } else {
            // 如果没有获取到后台指标，在前端计算
            console.log('未获取到后台标签排序指标，在前端计算');

            // 使用与后台相同的排序方法计算标签的排序分数
            for (const tab of groupTabs) {
              let score;

              if (currentSortMethod === 'title') {
                // 按标题排序
                score = tab.title || '';
              } else if (currentSortMethod === 'domain') {
                // 按域名排序
                const url = tab.url || '';
                const domain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
                score = domain;
              } else if (currentSortMethod === 'size' || currentSortMethod === 'smart') {
                // 智能排序（结合多个因素）
                // 使用更稳定的计算方法，避免随机性
                const urlScore = tab.url ? Math.min(tab.url.length / 100, 1) : 0; // URL长度分数
                const titleScore = tab.title ? Math.min(tab.title.length / 50, 1) : 0; // 标题长度分数

                // 提取域名
                const url = tab.url || '';
                const domain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
                const domainScore = domain.length / 20; // 域名长度分数

                // 加权平均
                score = (urlScore * 0.4) + (titleScore * 0.4) + (domainScore * 0.2);
              } else {
                // 默认按索引排序
                score = tab.index;
              }

              tabSortingMetrics[tab.id] = {
                score: score,
                title: tab.title || 'Unnamed Tab',
                url: tab.url || '',
                index: tab.index
              };

              console.log(`标签 ${tab.id} (${tab.title}) 的排序分数: ${score}`);
            }
          }
        } catch (error) {
          console.error('获取标签排序指标失败:', error);

          // 出错时使用简单的索引排序
          for (const tab of groupTabs) {
            tabSortingMetrics[tab.id] = {
              score: tab.index,
              title: tab.title || 'Unnamed Tab',
              url: tab.url || '',
              index: tab.index
            };
          }
        }

        // 根据分数对标签页进行排序
        const sortedTabs = [...groupTabs].sort((a, b) => {
          const scoreA = tabSortingMetrics[a.id]?.score;
          const scoreB = tabSortingMetrics[b.id]?.score;

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

        // 记录排序后的顺序
        console.log('popup中排序后的标签顺序:');
        sortedTabs.forEach((tab, index) => {
          console.log(`${index + 1}. ${tab.title} (ID: ${tab.id})`);
        });

        // 添加标签列表标题
        const tabListHeader = document.createElement('div');
        tabListHeader.className = 'tab-list-header';
        tabListHeader.innerHTML = `
          <div class="tab-header-title">标签名称</div>
          <div class="tab-header-info">
            <span>评分</span>
            <span>操作</span>
          </div>
        `;
        tabListContainer.appendChild(tabListHeader);

        // 添加标签项
        sortedTabs.forEach((tab, index) => {
          const tabItem = document.createElement('div');
          tabItem.className = 'tab-item';

          // 创建标签图标和标题
          const tabTitle = document.createElement('div');
          tabTitle.className = 'tab-title';

          // 添加序号
          const orderBadge = document.createElement('span');
          orderBadge.className = 'tab-order-badge';
          orderBadge.textContent = (index + 1).toString();
          tabTitle.appendChild(orderBadge);

          // 添加图标（如果有）
          if (tab.favIconUrl) {
            const tabIcon = document.createElement('img');
            tabIcon.className = 'tab-icon';
            tabIcon.src = tab.favIconUrl;
            tabIcon.onerror = () => {
              tabIcon.style.display = 'none';
            };
            tabTitle.appendChild(tabIcon);
          } else {
            const tabIcon = document.createElement('span');
            tabIcon.className = 'tab-icon-placeholder';
            tabIcon.innerHTML = '&#128196;'; // 文档图标
            tabTitle.appendChild(tabIcon);
          }

          // 添加标题文本
          const titleText = document.createElement('span');
          titleText.className = 'tab-title-text';
          titleText.textContent = tab.title || 'Unnamed Tab';
          titleText.title = tab.title || 'Unnamed Tab';
          tabTitle.appendChild(titleText);

          // 创建右侧区域
          const tabInfo = document.createElement('div');
          tabInfo.className = 'tab-info';

          // 添加排序评分
          const scoreIndicator = document.createElement('span');
          scoreIndicator.className = 'tab-score-indicator';

          // 获取排序评分
          let scoreText = `#${index + 1}`;
          let scoreTitle = '当前排序位置';

          if (tabSortingMetrics[tab.id]) {
            const metrics = tabSortingMetrics[tab.id];

            if (currentSortMethod === 'title') {
              scoreText = metrics.title.substring(0, 10) + (metrics.title.length > 10 ? '...' : '');
              scoreTitle = '标题';
            } else if (currentSortMethod === 'size') {
              scoreText = metrics.url.length.toString();
              scoreTitle = 'URL长度';
            } else if (currentSortMethod === 'smart') {
              scoreText = metrics.score.toFixed(2);
              scoreTitle = '智能排序评分';
            } else {
              scoreText = metrics.index.toString();
              scoreTitle = '标签索引';
            }
          }

          scoreIndicator.textContent = scoreText;
          scoreIndicator.title = `${scoreTitle}: ${scoreText}`;
          tabInfo.appendChild(scoreIndicator);

          // 添加操作按钮
          const tabActions = document.createElement('div');
          tabActions.className = 'tab-actions';

          // 添加激活按钮
          const activateButton = document.createElement('button');
          activateButton.className = 'tab-action-button';
          activateButton.title = '切换到此标签';
          activateButton.innerHTML = '&#128065;'; // 眼睛图标
          activateButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            chrome.tabs.update(tab.id, { active: true });
          });
          tabActions.appendChild(activateButton);

          tabInfo.appendChild(tabActions);

          // 添加到标签项
          tabItem.appendChild(tabTitle);
          tabItem.appendChild(tabInfo);

          // 添加点击事件
          tabItem.addEventListener('click', () => {
            chrome.tabs.update(tab.id, { active: true });
          });

          tabListContainer.appendChild(tabItem);
        });

        // 添加展开/折叠按钮的点击事件
        expandButton.addEventListener('click', (e) => {
          e.stopPropagation(); // 阻止事件冒泡

          const isExpanded = expandButton.dataset.expanded === 'true';
          const newExpandedState = !isExpanded;
          expandButton.dataset.expanded = newExpandedState.toString();

          // 更新按钮图标和容器显示状态
          expandButton.innerHTML = newExpandedState ? '&#9650;' : '&#9660;'; // 向上或向下箭头
          tabListContainer.style.display = newExpandedState ? 'block' : 'none';

          console.log(`标签组 ${group.id} 展开状态切换:`, isExpanded, '->', newExpandedState);
          console.log(`标签列表容器显示状态:`, tabListContainer.style.display);
        });

        // 创建一个包装容器，包含标签组项和标签列表
        const groupWrapper = document.createElement('div');
        groupWrapper.className = 'group-wrapper';

        // 添加标签组项到包装容器
        groupWrapper.appendChild(groupItem);

        // 添加标签列表容器到包装容器
        groupWrapper.appendChild(tabListContainer);

        // 调试信息
        console.log(`标签组 ${group.id} 的标签列表容器:`, tabListContainer);
        console.log(`标签组 ${group.id} 内有 ${groupTabs.length} 个标签`);
        console.log(`标签组 ${group.id} 的展开状态:`, wasExpanded);

        // 添加点击事件
        groupItem.addEventListener('click', () => {
          // 切换展开/折叠状态
          expandButton.click();
        });

        // 将整个包装容器添加到标签组列表
        groupListElement.appendChild(groupWrapper);
      });

      // 辅助函数：排序所有标签组
      async function sortAllTabGroups() {
        try {
          showStatus('正在排序所有标签组...', 'info');
          const response = await chrome.runtime.sendMessage({
            action: 'sortTabGroups'
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
