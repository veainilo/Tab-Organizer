/**
 * 后台脚本主入口
 */

import { WINDOW_ID_CURRENT, TAB_GROUP_ID_NONE } from './utils.js';
import { settings, loadSettings, saveSettings, updateSettings } from './settings.js';
import { groupTabsByDomain, ungroupAllTabs, isManualUngrouping, setManualUngrouping } from './tab-grouping.js';
import { sortTabsInGroup, getSortingMetrics } from './tab-sorting.js';
import { sortTabGroups } from './group-sorting.js';
import { executeMonitoringTask, updateMonitoringStatus, getNextExecutionTime } from './monitoring.js';

// 初始化 service worker
console.log('Edge Tab Organizer - Background Service Worker 已启动');

// 加载设置
loadSettings().then(() => {
  console.log('设置加载完成，初始化监控状态');
  
  // 监听存储变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.tabOrganizerSettings) {
      const oldSettings = settings;
      Object.assign(settings, changes.tabOrganizerSettings.newValue);
  
      // 检查是否需要更新监控状态
      const monitoringSettingsChanged =
        oldSettings.monitoringEnabled !== settings.monitoringEnabled ||
        oldSettings.extensionActive !== settings.extensionActive ||
        oldSettings.continuousMonitoring !== settings.continuousMonitoring ||
        oldSettings.autoGroupInterval !== settings.autoGroupInterval ||
        oldSettings.autoSortInterval !== settings.autoSortInterval;
  
      if (monitoringSettingsChanged) {
        console.log('监控设置已更改，更新监控状态');
        updateMonitoringStatus();
      }
    }
  });
  
  // 初始化监控状态
  updateMonitoringStatus();
});

// 处理标签创建事件
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('Tab created:', tab);
  console.log('autoGroupOnCreation setting:', settings.autoGroupOnCreation);

  // 如果扩展未激活或自动分组未启用，不执行任何操作
  if (!settings.extensionActive || !settings.autoGroupOnCreation) {
    console.log('扩展未激活或自动分组未启用，退出. 扩展激活状态:', settings.extensionActive);
    return;
  }

  // 如果是用户手动取消分组，不执行自动分组
  if (isManualUngrouping()) {
    console.log('用户手动取消分组，不执行自动分组');
    return;
  }

  // Wait a moment for the tab to load
  setTimeout(async () => {
    try {
      // Get updated tab info
      const updatedTab = await chrome.tabs.get(tab.id);
      console.log('Updated tab info:', updatedTab);

      if (!updatedTab.url) {
        console.log('Tab has no URL, skipping');
        return;
      }

      const domain = getDomainForGrouping(updatedTab.url);
      console.log('Domain for grouping:', domain);

      if (!domain || settings.excludeDomains.includes(domain)) {
        console.log('Domain is empty or excluded, skipping');
        return;
      }

      // 获取当前窗口的所有标签组
      const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      console.log('当前窗口的标签组:', groups.length, '个');

      // 查找是否已存在该域名的组
      let existingGroupId = null;
      for (const group of groups) {
        if (group.title === domain) {
          existingGroupId = group.id;
          break;
        }
      }

      if (existingGroupId) {
        // 添加到现有组
        console.log('添加到已存在的组:', domain, '组ID:', existingGroupId);
        await chrome.tabs.group({ tabIds: [tab.id], groupId: existingGroupId });
        console.log('标签页已添加到现有组');
      } else {
        // 创建新组
        const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
        console.log('新组创建成功，ID:', groupId);

        // 设置组标题和颜色
        const color = getColorForDomain(domain);
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: color
        });
        console.log('组标题和颜色已设置');
      }
    } catch (error) {
      console.error('Error handling new tab:', error);
    }
  }, 1000); // Wait 1 second for the tab to load
});

// 处理标签更新事件（URL变化）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 如果扩展未激活或自动分组未启用，不执行任何操作
  if (!settings.extensionActive || !settings.autoGroupByDomain) return;
  if (!changeInfo.url) return;

  // 如果是用户手动取消分组，不执行自动分组
  if (isManualUngrouping()) return;

  // Wait a moment for the tab to fully update
  setTimeout(async () => {
    try {
      const domain = getDomainForGrouping(tab.url);
      if (!domain || settings.excludeDomains.includes(domain)) {
        // If tab is in a group, remove it
        if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
          await chrome.tabs.ungroup(tabId);
        }
        return;
      }

      // 检查标签页是否已经在正确的组中
      if (tab.groupId !== TAB_GROUP_ID_NONE) {
        try {
          const group = await chrome.tabGroups.get(tab.groupId);
          if (group.title === domain) {
            console.log('标签页已在正确的组中:', tabId, '组:', group.title);
            return; // 已经在正确的组中，不需要任何操作
          }
        } catch (error) {
          console.error('获取标签组信息失败:', error);
        }
      }

      // 获取当前窗口的所有标签组
      const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      console.log('当前窗口的标签组:', groups.length, '个');

      // 查找是否已存在该域名的组
      let existingGroupId = null;
      for (const group of groups) {
        if (group.title === domain) {
          existingGroupId = group.id;
          break;
        }
      }

      // 如果标签页在其他组中，先移除
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tabId);
      }

      if (existingGroupId) {
        // 添加到现有组
        console.log('添加到已存在的组:', domain, '组ID:', existingGroupId);
        await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroupId });
        console.log('标签页已添加到现有组');
      } else {
        // 创建新组
        const groupId = await chrome.tabs.group({ tabIds: [tabId] });
        console.log('新组创建成功，ID:', groupId);

        // 设置组标题和颜色
        const color = getColorForDomain(domain);
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: color
        });
        console.log('组标题和颜色已设置');
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }, 500); // Wait 0.5 seconds for the tab to fully update
});

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('收到消息:', message);

  // 测试消息
  if (message.action === 'test') {
    console.log('收到测试消息:', message.data);
    sendResponse({ success: true, message: 'Background script received your message: ' + message.data });
    return true;
  }

  // 检查 service worker 状态
  if (message.action === 'checkServiceWorker') {
    console.log('收到检查 service worker 状态消息');
    sendResponse({
      success: true,
      message: 'Service worker is active',
      timestamp: Date.now(),
      settings: settings
    });
    return true;
  }

  // 按域名分组标签页
  if (message.action === 'groupByDomain') {
    console.log('处理 groupByDomain 消息');

    // 立即发送一个初始响应
    sendResponse({ success: true, status: 'processing' });

    // 异步执行分组操作
    groupTabsByDomain().then(success => {
      console.log('groupByDomain 执行结果:', success);

      // 发送完成消息
      chrome.runtime.sendMessage({
        action: 'groupByDomainComplete',
        success: true
      }).catch(err => {
        console.error('发送完成消息失败:', err);
      });
    }).catch(error => {
      console.error('Error in groupByDomain:', error);

      // 发送错误消息
      chrome.runtime.sendMessage({
        action: 'groupByDomainComplete',
        success: false,
        error: error.message
      }).catch(err => {
        console.error('发送错误消息失败:', err);
      });
    });

    return true;
  }

  // 取消所有标签页分组
  if (message.action === 'ungroupAll') {
    console.log('处理 ungroupAll 消息');
    ungroupAllTabs().then(response => {
      console.log('ungroupAll 执行结果:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Error in ungroupAll:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 获取排序指标
  if (message.action === 'getSortingMetrics') {
    console.log('处理 getSortingMetrics 消息');
    getSortingMetrics().then(response => {
      console.log('getSortingMetrics 执行结果:', response.success);
      sendResponse(response);
    }).catch(error => {
      console.error('Error in getSortingMetrics:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 对标签组排序
  if (message.action === 'sortTabGroups') {
    console.log('处理 sortTabGroups 消息');
    sortTabGroups().then(success => {
      console.log('sortTabGroups 执行结果:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('Error in sortTabGroups:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 对单个标签组内的标签排序
  if (message.action === 'sortTabsInGroup') {
    console.log('处理 sortTabsInGroup 消息');
    if (!message.groupId) {
      console.error('缺少 groupId 参数');
      sendResponse({ success: false, error: 'Missing groupId parameter' });
      return true;
    }

    sortTabsInGroup(message.groupId).then(success => {
      console.log('sortTabsInGroup 执行结果:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('Error in sortTabsInGroup:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 获取插件状态
  if (message.action === 'getExtensionStatus') {
    console.log('处理 getExtensionStatus 消息');
    sendResponse({
      success: true,
      active: settings.extensionActive,
      settings: settings
    });
    return true;
  }

  // 切换插件激活状态
  if (message.action === 'toggleExtensionActive') {
    console.log('处理 toggleExtensionActive 消息');
    const newState = message.active !== undefined ? message.active : !settings.extensionActive;
    settings.extensionActive = newState;

    // 如果激活了插件，自动对所有标签页进行分组
    if (settings.extensionActive) {
      groupTabsByDomain().then(() => {
        console.log('插件激活，已对所有标签页进行分组');
      }).catch(error => {
        console.error('Error grouping tabs after activation:', error);
      });

      // 更新监控状态
      updateMonitoringStatus();
    } else {
      // 停止监控
      stopContinuousMonitoring();
    }

    // 保存设置
    saveSettings();

    sendResponse({
      success: true,
      active: settings.extensionActive
    });
    return true;
  }

  // 切换持续监控状态
  if (message.action === 'toggleMonitoring') {
    console.log('处理 toggleMonitoring 消息');
    const newState = message.enabled !== undefined ? message.enabled : !settings.monitoringEnabled;
    settings.monitoringEnabled = newState;

    // 更新监控状态
    updateMonitoringStatus();

    // 保存设置
    saveSettings();

    sendResponse({
      success: true,
      monitoringEnabled: settings.monitoringEnabled
    });
    return true;
  }

  // 更新监控设置
  if (message.action === 'updateMonitoringSettings') {
    console.log('处理 updateMonitoringSettings 消息');

    if (message.autoGroupInterval !== undefined) {
      settings.autoGroupInterval = message.autoGroupInterval;
    }

    if (message.autoSortInterval !== undefined) {
      settings.autoSortInterval = message.autoSortInterval;
    }

    // 更新监控状态
    updateMonitoringStatus();

    // 保存设置
    saveSettings();

    sendResponse({
      success: true,
      settings: settings
    });
    return true;
  }

  // 更新排序方法
  if (message.action === 'updateSortingMethod') {
    console.log('处理 updateSortingMethod 消息');

    if (message.method !== undefined) {
      // 检查是标签组排序方法还是标签排序方法
      if (message.target === 'tabs') {
        settings.sortingMethod = message.method;
        console.log('标签排序方法已更新为:', settings.sortingMethod);
        
        // 保存设置
        saveSettings();
        
        // 如果更新了排序方法，自动执行一次标签排序
        if (settings.extensionActive && settings.enableTabSorting) {
          // 获取所有标签组
          chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT }).then(groups => {
            // 对每个标签组内的标签进行排序
            for (const group of groups) {
              sortTabsInGroup(group.id).then(success => {
                console.log(`标签组 ${group.id} 内的标签排序结果:`, success ? '成功' : '失败');
              }).catch(error => {
                console.error(`标签组 ${group.id} 内的标签排序失败:`, error);
              });
            }
          }).catch(error => {
            console.error('获取标签组失败:', error);
          });
        }
      } else {
        // 默认更新标签组排序方法
        settings.groupSortingMethod = message.method;
        console.log('标签组排序方法已更新为:', settings.groupSortingMethod);
        
        // 保存设置
        saveSettings();
        
        // 如果更新了排序方法，自动执行一次排序
        if (settings.extensionActive && settings.enableGroupSorting) {
          sortTabGroups().then(() => {
            console.log('排序方法已更新，已重新排序标签组');
          }).catch(error => {
            console.error('排序标签组失败:', error);
          });
        }
      }
    }

    sendResponse({
      success: true,
      settings: settings
    });
    return true;
  }

  // 切换排序顺序
  if (message.action === 'toggleSortOrder') {
    console.log('处理 toggleSortOrder 消息');

    // 检查是标签组排序顺序还是标签排序顺序
    if (message.target === 'tabs') {
      // 切换标签排序顺序
      settings.sortAscending = !settings.sortAscending;
      console.log('标签排序顺序已切换为:', settings.sortAscending ? '升序' : '降序');
      
      // 保存设置
      saveSettings();
      
      // 如果切换了排序顺序，自动执行一次标签排序
      if (settings.extensionActive && settings.enableTabSorting) {
        // 获取所有标签组
        chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT }).then(groups => {
          // 对每个标签组内的标签进行排序
          for (const group of groups) {
            sortTabsInGroup(group.id).then(success => {
              console.log(`标签组 ${group.id} 内的标签排序结果:`, success ? '成功' : '失败');
            }).catch(error => {
              console.error(`标签组 ${group.id} 内的标签排序失败:`, error);
            });
          }
        }).catch(error => {
          console.error('获取标签组失败:', error);
        });
      }
      
      sendResponse({
        success: true,
        settings: settings,
        sortAscending: settings.sortAscending,
        target: 'tabs'
      });
    } else {
      // 切换标签组排序顺序
      settings.groupSortAscending = !settings.groupSortAscending;
      console.log('标签组排序顺序已切换为:', settings.groupSortAscending ? '升序' : '降序');
      
      // 保存设置
      saveSettings();
      
      // 如果切换了排序顺序，自动执行一次排序
      if (settings.extensionActive && settings.enableGroupSorting) {
        sortTabGroups().then(() => {
          console.log('排序顺序已切换，已重新排序标签组');
        }).catch(error => {
          console.error('排序标签组失败:', error);
        });
      }
      
      sendResponse({
        success: true,
        settings: settings,
        sortAscending: settings.groupSortAscending,
        target: 'groups'
      });
    }
    
    return true;
  }

  // 更新监控间隔
  if (message.action === 'updateMonitoringInterval') {
    console.log('处理 updateMonitoringInterval 消息');

    if (message.interval !== undefined && message.interval >= 1000) {
      settings.autoGroupInterval = message.interval;

      // 保存设置
      saveSettings();

      // 更新监控状态
      updateMonitoringStatus();

      console.log('监控间隔已更新为:', settings.autoGroupInterval);
    }

    sendResponse({
      success: true,
      interval: settings.autoGroupInterval
    });
    return true;
  }

  // 获取下一次执行时间
  if (message.action === 'getNextExecutionTime') {
    console.log('处理 getNextExecutionTime 消息');

    sendResponse({
      success: true,
      nextExecutionTime: getNextExecutionTime(),
      monitoringEnabled: settings.monitoringEnabled,
      extensionActive: settings.extensionActive,
      autoGroupInterval: settings.autoGroupInterval
    });
    return true;
  }

  // 未知消息
  console.warn('收到未知消息:', message);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// 输出初始化完成消息
console.log('Edge Tab Organizer - Background Service Worker 初始化完成');
