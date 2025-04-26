/**
 * 标签组UI管理模块
 */

import { TAB_GROUP_ID_NONE, WINDOW_ID_CURRENT, getMessage, showErrorInContainer, getGroupColorBackground, getGroupColorText } from './utils.js';

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
    sortControls.appendChild(document.createTextNode('排序: '));
    sortControls.appendChild(sortMethodSelector);
    sortControls.appendChild(sortOrderToggle);

    headerRow.appendChild(sortControls);
    groupListElement.appendChild(headerRow);

    // 添加标签组列表
    for (const group of sortedGroups) {
      const groupItem = document.createElement('div');
      groupItem.className = 'group-item';
      groupItem.dataset.groupId = group.id;

      // 创建标签组标题栏
      const groupHeader = document.createElement('div');
      groupHeader.className = 'group-header';
      groupHeader.style.backgroundColor = getGroupColorBackground(group.color);
      groupHeader.style.color = getGroupColorText(group.color);

      // 创建展开/折叠按钮
      const expandButton = document.createElement('button');
      expandButton.className = 'expand-button';
      expandButton.dataset.groupId = group.id;
      
      // 检查是否有保存的展开状态，如果没有则默认为折叠
      const isExpanded = groupExpandStates[group.id] !== undefined ? 
        groupExpandStates[group.id] : false;
      expandButton.dataset.expanded = isExpanded.toString();
      expandButton.textContent = isExpanded ? '▼' : '►';
      expandButton.title = isExpanded ? '折叠' : '展开';

      // 创建标签组标题
      const groupTitle = document.createElement('span');
      groupTitle.className = 'group-title';
      groupTitle.textContent = group.title || 'Unnamed Group';

      // 创建标签数量指示器
      const tabCount = document.createElement('span');
      tabCount.className = 'tab-count';
      tabCount.textContent = groupTabCounts[group.id] || 0;

      // 添加元素到标题栏
      groupHeader.appendChild(expandButton);
      groupHeader.appendChild(groupTitle);
      groupHeader.appendChild(tabCount);

      // 创建标签列表容器
      const tabList = document.createElement('div');
      tabList.className = 'tab-list';
      tabList.style.display = isExpanded ? 'block' : 'none';

      // 获取组内的标签页
      const groupTabs = tabs.filter(tab => tab.groupId === group.id);
      
      // 按索引排序
      groupTabs.sort((a, b) => a.index - b.index);

      // 添加标签页到列表
      for (const tab of groupTabs) {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        tabItem.dataset.tabId = tab.id;

        // 创建标签图标
        const tabIcon = document.createElement('img');
        tabIcon.className = 'tab-icon';
        tabIcon.src = tab.favIconUrl || 'icons/icon16.png';
        tabIcon.onerror = () => {
          tabIcon.src = 'icons/icon16.png';
        };

        // 创建标签标题
        const tabTitle = document.createElement('span');
        tabTitle.className = 'tab-title';
        tabTitle.textContent = tab.title || 'Unnamed Tab';
        tabTitle.title = tab.title || 'Unnamed Tab';

        // 添加元素到标签项
        tabItem.appendChild(tabIcon);
        tabItem.appendChild(tabTitle);

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
        expandButton.textContent = !isExpanded ? '▼' : '►';
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
