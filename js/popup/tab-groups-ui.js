/**
 * 标签组UI管理模块
 */

import { TAB_GROUP_ID_NONE, WINDOW_ID_CURRENT, showErrorInContainer, getGroupColorBackground, getGroupColorText } from './utils.js';
import { calculateTabScore, calculateGroupScore, sortTabsByScore, sortGroupsByScore, getTabScoringDetails, getGroupScoringDetails } from '../scoring.js';

// 保存标签组展开状态的对象
const groupExpandStates = {};

/**
 * 加载并显示当前标签组
 * @param {HTMLElement} groupListElement - 标签组列表元素
 * @param {HTMLElement} noGroupsElement - 无标签组提示元素
 */
async function loadTabGroups(groupListElement, noGroupsElement) {
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

    // 清空组列表，以防出错时显示旧数据
    while (groupListElement.firstChild) {
      groupListElement.removeChild(groupListElement.firstChild);
    }

    // Get all tab groups in the current window
    let groups = [];
    try {
      groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
      console.log('查询到的标签组:', groups);
    } catch (error) {
      showErrorInContainer(groupListElement, '加载标签页组时出错', error);
      return;
    }

    if (!groups || groups.length === 0) {
      console.log('没有标签组，显示提示信息');
      groupListElement.appendChild(noGroupsElement);
      return;
    }

    // Get all tabs to count tabs in each group and determine their order
    let tabs = [];
    try {
      tabs = await chrome.tabs.query({ currentWindow: true });
      console.log('查询到的标签页:', tabs);
    } catch (error) {
      showErrorInContainer(groupListElement, '加载标签页时出错', error);
      return;
    }

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
      } else {
        // 如果没有指标数据，使用统一的评分函数计算
        const groupTabs = tabs.filter(tab => tab.groupId === group.id);
        score = calculateGroupScore(group, groupTabs, currentSortMethod);
      }

      groupScores[group.id] = score;
    }

    // 使用统一的排序函数根据分数对组进行排序
    const sortedGroups = sortGroupsByScore(groups, groupScores, sortAscending);

    // 添加标题行，显示排序顺序和排序控制
    const headerRow = document.createElement('div');
    headerRow.className = 'sort-controls-header';

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
          loadTabGroups(groupListElement, noGroupsElement); // 重新加载标签组列表
        }
      });
    });

    // 添加排序顺序切换按钮的事件监听器
    sortOrderToggle.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'toggleSortOrder'
      }, (response) => {
        if (response && response.success) {
          loadTabGroups(groupListElement, noGroupsElement); // 重新加载标签组列表
        }
      });
    });

    // 添加排序控制到标题行
    const sortControls = document.createElement('div');
    sortControls.className = 'sort-controls';
    sortControls.appendChild(sortMethodSelector);
    sortControls.appendChild(sortOrderToggle);

    headerRow.appendChild(sortControls);
    groupListElement.appendChild(headerRow);

    // 添加标签组列表
    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i];
      const groupItem = document.createElement('div');
      groupItem.className = 'group-item';
      groupItem.dataset.groupId = group.id;
      groupItem.dataset.sortIndex = i;

      // 创建标签组标题栏
      const groupHeader = document.createElement('div');
      groupHeader.className = 'group-item-header';
      groupHeader.style.backgroundColor = getGroupColorBackground(group.color);
      groupHeader.style.color = getGroupColorText(group.color);

      // 创建排序序号指示器
      const orderIndicator = document.createElement('span');
      orderIndicator.className = 'order-indicator';
      orderIndicator.textContent = (i + 1).toString();

      // 创建展开/折叠按钮
      const expandButton = document.createElement('button');
      expandButton.className = 'expand-button';
      expandButton.dataset.groupId = group.id;

      // 检查是否有保存的展开状态，如果没有则默认为折叠
      const isExpanded = groupExpandStates[group.id] !== undefined ?
        groupExpandStates[group.id] : false;
      expandButton.dataset.expanded = isExpanded.toString();
      expandButton.innerHTML = isExpanded ? '&#9660;' : '&#9658;'; // 使用HTML实体代码
      expandButton.title = isExpanded ? '折叠' : '展开';

      // 创建标签组标题
      const groupTitle = document.createElement('span');
      groupTitle.className = 'group-title';
      groupTitle.textContent = group.title || 'Unnamed Group';

      // 创建标签数量指示器
      const tabCount = document.createElement('span');
      tabCount.className = 'tab-count';
      tabCount.textContent = groupTabCounts[group.id] || 0;

      // 获取组内的标签页 - 移到这里，确保在使用前定义
      const groupTabs = tabs.filter(tab => tab.groupId === group.id);

      // 创建排序分数指示器
      const scoreIndicator = document.createElement('span');
      scoreIndicator.className = 'score-indicator';

      // 获取排序分数
      let scoreText = '';
      if (groupScores[group.id] !== undefined) {
        const score = groupScores[group.id];
        if (typeof score === 'number') {
          scoreText = score.toFixed(2); // 数字格式化为两位小数
        } else {
          scoreText = String(score);
        }
      }

      // 获取详细的分数计算信息
      const groupScoringDetails = getGroupScoringDetails(group, groupTabs, currentSortMethod);

      // 创建分数详情提示（完整信息放在tooltip中）
      let detailsTooltip = `分数: ${scoreText}\n排序方法: ${currentSortMethod}\n`;

      // 添加各个因素的详情
      if (groupScoringDetails.factors && groupScoringDetails.factors.length > 0) {
        detailsTooltip += '\n计算因素:\n';
        for (const factor of groupScoringDetails.factors) {
          detailsTooltip += `- ${factor.name}: ${factor.score} (权重: ${factor.weight})\n`;
        }
      }

      // 创建简洁的计算过程显示
      let displayText = `分数: ${scoreText} (${currentSortMethod})`;

      // 如果有计算因素，直接在分数指示器上显示简洁的计算过程
      if (groupScoringDetails.factors && groupScoringDetails.factors.length > 0) {
        displayText += '\n计算: ';
        const factorTexts = [];
        for (const factor of groupScoringDetails.factors) {
          factorTexts.push(`${factor.name}(${factor.score}) × ${factor.weight}`);
        }
        displayText += factorTexts.join(' + ');
      }

      scoreIndicator.title = detailsTooltip; // 完整信息仍然保留在tooltip中
      scoreIndicator.textContent = displayText;

      // 创建标题行容器（包含序号、展开按钮、标题和标签数量）
      const titleRow = document.createElement('div');
      titleRow.className = 'group-title-row';

      // 添加元素到标题行
      titleRow.appendChild(orderIndicator);
      titleRow.appendChild(expandButton);
      titleRow.appendChild(groupTitle);
      titleRow.appendChild(tabCount);

      // 创建分数行容器
      const scoreRow = document.createElement('div');
      scoreRow.className = 'group-score-row';

      // 添加分数指示器到分数行
      scoreRow.appendChild(scoreIndicator);

      // 添加行到标题栏
      groupHeader.appendChild(titleRow);
      groupHeader.appendChild(scoreRow);

      // 创建标签列表容器
      const tabList = document.createElement('div');
      tabList.className = 'tab-list';
      tabList.style.display = isExpanded ? 'block' : 'none';

      // 获取当前标签排序方法和排序顺序
      let tabSortMethod = 'position'; // 默认按位置排序
      let tabSortAscending = true; // 默认升序

      try {
        const statusResponse = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });
        if (statusResponse && statusResponse.success && statusResponse.settings) {
          tabSortMethod = statusResponse.settings.sortingMethod || 'position';
          tabSortAscending = statusResponse.settings.sortAscending !== false;
        }
      } catch (error) {
        console.error('获取标签排序设置失败:', error);
      }

      // 计算标签页的排序分数
      const tabScores = {};
      for (const tab of groupTabs) {
        // 使用统一的评分函数
        const score = calculateTabScore(tab, tabSortMethod);
        tabScores[tab.id] = score;
      }

      // 使用统一的排序函数对标签进行排序
      // 这样在popup中显示的顺序将与实际排序顺序一致
      const sortedGroupTabs = sortTabsByScore(groupTabs, tabScores, tabSortAscending);

      // 使用排序后的标签列表，而不是按索引排序的列表
      const displayTabs = sortedGroupTabs;

      // 添加标签页到列表
      for (const tab of displayTabs) {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        tabItem.dataset.tabId = tab.id;

        // 创建标签内容容器
        const tabItemContent = document.createElement('div');
        tabItemContent.className = 'tab-item-content';

        // 创建图标容器
        const iconContainer = document.createElement('div');
        iconContainer.className = 'tab-icon-container';

        // 创建标签图标
        const tabIcon = document.createElement('img');
        tabIcon.className = 'tab-icon';
        tabIcon.src = tab.favIconUrl || 'icons/icon16.png';
        tabIcon.onerror = () => {
          tabIcon.src = 'icons/icon16.png';
        };
        iconContainer.appendChild(tabIcon);

        // 创建标签标题
        const tabTitle = document.createElement('div');
        tabTitle.className = 'tab-title';
        tabTitle.textContent = tab.title || 'Unnamed Tab';
        tabTitle.title = tab.title || 'Unnamed Tab';

        // 尝试提取域名并显示
        let domain = '';
        try {
          if (tab.url) {
            const url = new URL(tab.url);
            domain = url.hostname;
          }
        } catch (e) {
          console.log('无法解析URL:', tab.url);
        }

        // 创建文本容器
        const textContainer = document.createElement('div');
        textContainer.className = 'tab-text-container';

        // 添加标题到文本容器
        textContainer.appendChild(tabTitle);

        // 如果有域名，添加域名显示
        if (domain) {
          const tabDomain = document.createElement('div');
          tabDomain.className = 'tab-domain';
          tabDomain.textContent = domain;
          textContainer.appendChild(tabDomain);
        }

        // 创建标签分数指示器
        const tabScoreIndicator = document.createElement('div');
        tabScoreIndicator.className = 'tab-score-indicator';

        // 获取排序分数
        let scoreText = '';
        if (tabScores[tab.id] !== undefined) {
          const score = tabScores[tab.id];
          if (typeof score === 'number') {
            scoreText = score.toFixed(2); // 数字格式化为两位小数
          } else {
            scoreText = String(score);
          }
        }

        // 获取详细的分数计算信息
        const tabScoringDetails = getTabScoringDetails(tab, tabSortMethod);

        // 创建分数详情提示（完整信息放在tooltip中）
        let detailsTooltip = `分数: ${scoreText}\n排序方法: ${tabSortMethod}\n`;

        // 添加各个因素的详情
        if (tabScoringDetails.factors && tabScoringDetails.factors.length > 0) {
          detailsTooltip += '\n计算因素:\n';
          for (const factor of tabScoringDetails.factors) {
            detailsTooltip += `- ${factor.name}: ${factor.score} (权重: ${factor.weight})\n`;
            if (factor.value) {
              detailsTooltip += `  值: ${factor.value}\n`;
            }
          }
        }

        // 创建简洁的计算过程显示
        let displayText = `分数: ${scoreText} (${tabSortMethod})`;

        // 如果有计算因素，直接在分数指示器上显示简洁的计算过程
        if (tabScoringDetails.factors && tabScoringDetails.factors.length > 0) {
          displayText += '\n计算: ';
          const factorTexts = [];
          for (const factor of tabScoringDetails.factors) {
            factorTexts.push(`${factor.name}(${factor.score}) × ${factor.weight}`);
          }
          displayText += factorTexts.join(' + ');
        }

        tabScoreIndicator.title = detailsTooltip; // 完整信息仍然保留在tooltip中
        tabScoreIndicator.textContent = displayText;
        textContainer.appendChild(tabScoreIndicator);

        // 添加元素到标签内容容器
        tabItemContent.appendChild(iconContainer);
        tabItemContent.appendChild(textContainer);

        // 添加内容容器到标签项
        tabItem.appendChild(tabItemContent);

        // 添加点击事件，激活标签页
        tabItem.addEventListener('click', () => {
          chrome.tabs.update(tab.id, { active: true });
        });

        tabList.appendChild(tabItem);
      }

      // 添加展开/折叠按钮的事件监听器
      expandButton.addEventListener('click', () => {
        const isExpanded = expandButton.dataset.expanded === 'true';
        expandButton.dataset.expanded = (!isExpanded).toString();
        expandButton.innerHTML = !isExpanded ? '&#9660;' : '&#9658;'; // 使用HTML实体代码
        expandButton.title = !isExpanded ? '折叠' : '展开';
        tabList.style.display = !isExpanded ? 'block' : 'none';

        // 保存展开状态
        groupExpandStates[group.id] = !isExpanded;
      });

      // 添加元素到组项
      groupItem.appendChild(groupHeader);
      groupItem.appendChild(tabList);

      // 添加组项到组列表
      groupListElement.appendChild(groupItem);
    }
  } catch (error) {
    console.error('加载标签组失败:', error);
    showErrorInContainer(groupListElement, '加载标签组失败', error);
  }
}

// 导出函数
export {
  loadTabGroups
};
