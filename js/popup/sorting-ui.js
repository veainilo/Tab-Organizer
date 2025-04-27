/**
 * 排序UI管理模块
 */

import { WINDOW_ID_CURRENT, getMessage, showStatus, showErrorInContainer, getGroupColorBackground, getGroupColorText, updateSortOrderButton } from './utils.js';

/**
 * 加载并显示排序指标数据
 * @param {HTMLElement} sortingMetricsElement - 排序指标元素
 * @param {HTMLElement} sortingMetricsContainer - 排序指标容器
 */
function loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer) {
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
        showErrorInContainer(sortingMetricsElement, '发送 getSortingMetrics 消息失败', chrome.runtime.lastError);
        return;
      }

      // 检查响应是否存在
      if (!response) {
        const error = new Error('No response from background script');
        showErrorInContainer(sortingMetricsElement, '未收到后台脚本响应', error);
        return;
      }

      // 检查响应是否成功
      if (!response.success) {
        const error = new Error(response.error || 'Unknown error');
        showErrorInContainer(sortingMetricsElement, '加载排序指标失败', error);
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
    showErrorInContainer(sortingMetricsElement, '发送 getSortingMetrics 消息时出错', error);
  }
}

/**
 * 添加指标项
 * @param {HTMLElement} container - 容器元素
 * @param {string} name - 指标名称
 * @param {string|number} value - 指标值
 * @param {number} weight - 权重
 * @param {string} icon - 图标
 */
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

/**
 * 初始化排序设置
 * @param {HTMLElement} groupSortingMethod - 标签组排序方法选择器
 * @param {HTMLElement} groupSortOrder - 标签组排序顺序按钮
 * @param {HTMLElement} groupSortOrderIcon - 标签组排序顺序图标
 * @param {HTMLElement} groupSortOrderText - 标签组排序顺序文本
 * @param {HTMLElement} tabSortingMethod - 标签排序方法选择器
 * @param {HTMLElement} tabSortOrder - 标签排序顺序按钮
 * @param {HTMLElement} tabSortOrderIcon - 标签排序顺序图标
 * @param {HTMLElement} tabSortOrderText - 标签排序顺序文本
 */
function initSortingSettings(
  groupSortingMethod, groupSortOrder, groupSortOrderIcon, groupSortOrderText,
  tabSortingMethod, tabSortOrder, tabSortOrderIcon, tabSortOrderText,
  sortingMetricsElement, sortingMetricsContainer
) {
  // 获取当前排序方法和顺序显示元素
  const currentSortMethod = document.getElementById('currentSortMethod');
  const currentSortOrder = document.getElementById('currentSortOrder');
  // 获取当前设置
  chrome.runtime.sendMessage({ action: 'getExtensionStatus' }, (response) => {
    if (response && response.success && response.settings) {
      const settings = response.settings;

      // 设置标签组排序方法
      if (settings.groupSortingMethod) {
        groupSortingMethod.value = settings.groupSortingMethod;

        // 更新当前排序方法显示
        if (currentSortMethod) {
          const methodText = groupSortingMethod.options[groupSortingMethod.selectedIndex].text;
          currentSortMethod.textContent = methodText;
        }
      }

      // 设置标签组排序顺序
      updateSortOrderButton(groupSortOrderIcon, groupSortOrderText, settings.groupSortAscending);

      // 更新当前排序顺序显示
      if (currentSortOrder) {
        currentSortOrder.textContent = settings.groupSortAscending ? '升序' : '降序';
      }

      // 设置标签排序方法
      if (settings.sortingMethod) {
        tabSortingMethod.value = settings.sortingMethod;
      }

      // 设置标签排序顺序
      updateSortOrderButton(tabSortOrderIcon, tabSortOrderText, settings.sortAscending);
    }
  });

  // 添加标签组排序方法变更事件
  groupSortingMethod.addEventListener('change', () => {
    const method = groupSortingMethod.value;
    const methodText = groupSortingMethod.options[groupSortingMethod.selectedIndex].text;
    console.log('标签组排序方法变更为:', method);

    // 更新当前排序方法显示
    if (currentSortMethod) {
      currentSortMethod.textContent = methodText;
    }

    chrome.runtime.sendMessage({
      action: 'updateSortingMethod',
      method: method,
      target: 'groups'
    }, (response) => {
      if (response && response.success) {
        showStatus('标签组排序方法已更新', 'success');
        // 重新加载排序指标
        loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer);
      } else {
        showStatus('更新标签组排序方法失败', 'error');
      }
    });
  });

  // 添加标签组排序顺序变更事件
  groupSortOrder.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'toggleSortOrder',
      target: 'groups'
    }, (response) => {
      if (response && response.success) {
        const ascending = response.sortAscending;
        updateSortOrderButton(groupSortOrderIcon, groupSortOrderText, ascending);

        // 更新当前排序顺序显示
        if (currentSortOrder) {
          currentSortOrder.textContent = ascending ? '升序' : '降序';
        }

        showStatus('标签组排序顺序已更新', 'success');
        // 重新加载排序指标
        loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer);
      } else {
        showStatus('更新标签组排序顺序失败', 'error');
      }
    });
  });

  // 添加标签排序方法变更事件
  tabSortingMethod.addEventListener('change', () => {
    const method = tabSortingMethod.value;
    console.log('标签排序方法变更为:', method);

    chrome.runtime.sendMessage({
      action: 'updateSortingMethod',
      method: method,
      target: 'tabs'
    }, (response) => {
      if (response && response.success) {
        showStatus('标签排序方法已更新', 'success');
        // 重新加载排序指标
        loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer);
      } else {
        showStatus('更新标签排序方法失败', 'error');
      }
    });
  });

  // 添加标签排序顺序变更事件
  tabSortOrder.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'toggleSortOrder',
      target: 'tabs'
    }, (response) => {
      if (response && response.success) {
        const ascending = response.sortAscending;
        updateSortOrderButton(tabSortOrderIcon, tabSortOrderText, ascending);
        showStatus('标签排序顺序已更新', 'success');
        // 重新加载排序指标
        loadSortingMetrics(sortingMetricsElement, sortingMetricsContainer);
      } else {
        showStatus('更新标签排序顺序失败', 'error');
      }
    });
  });
}

// 导出函数
export {
  loadSortingMetrics,
  initSortingSettings
};
