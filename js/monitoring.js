/**
 * 持续监控逻辑模块
 */

import { WINDOW_ID_CURRENT } from './utils.js';
import { settings } from './settings.js';
import { isManualUngrouping } from './tab-grouping.js';
import { groupTabsByDomain } from './tab-grouping.js';
import { sortTabsInGroup } from './tab-sorting.js';
import { sortTabGroups } from './group-sorting.js';

// 定时器ID和下一次执行时间
let autoGroupTimerId = null; // 用于自动监控的定时器ID
let nextExecutionTime = 0; // 下一次执行时间的时间戳

/**
 * 执行自动监控任务
 */
async function executeMonitoringTask() {
  console.log('执行自动监控任务');
  console.log('当前设置状态:', {
    extensionActive: settings.extensionActive,
    monitoringEnabled: settings.monitoringEnabled,
    autoGroupByDomain: settings.autoGroupByDomain,
    enableGroupSorting: settings.enableGroupSorting,
    enableTabSorting: settings.enableTabSorting,
    autoGroupInterval: settings.autoGroupInterval
  });

  if (!settings.extensionActive || isManualUngrouping()) {
    console.log('扩展未激活或正在手动取消分组，跳过自动监控任务');
    return;
  }

  try {
    // 1. 首先对标签进行分组
    if (settings.autoGroupByDomain) {
      console.log('执行自动分组');
      await groupTabsByDomain();
    } else {
      console.log('自动分组未启用，跳过分组步骤');
    }
    
    // 2. 然后对标签组进行排序 - 强制执行，确保排序生效
    console.log('执行自动标签组排序 - 开始');
    const groupSortResult = await sortTabGroups();
    console.log('标签组排序结果:', groupSortResult ? '成功' : '失败');
    
    // 3. 最后对每个标签组内的标签进行排序 - 强制执行，确保排序生效
    console.log('执行自动标签组内标签排序 - 开始');
    
    // 获取所有标签组
    const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
    console.log('找到', groups.length, '个标签组需要排序');
    
    if (groups.length > 0) {
      // 对每个标签组内的标签进行排序
      for (const group of groups) {
        console.log('排序标签组:', group.id, group.title || '未命名组');
        const tabSortResult = await sortTabsInGroup(group.id);
        console.log('标签组内标签排序结果:', tabSortResult ? '成功' : '失败');
      }
    } else {
      console.log('没有找到标签组，跳过组内标签排序');
    }
    
    console.log('自动监控任务完成');
  } catch (error) {
    console.error('自动监控任务出错:', error);
  }
}

/**
 * 启动持续监控
 */
function startContinuousMonitoring() {
  if (!settings.monitoringEnabled || !settings.extensionActive) {
    console.log('持续监控未启用或扩展未激活，不启动监控');
    return;
  }

  console.log('启动持续监控');

  // 停止现有的定时器（如果有）
  stopContinuousMonitoring();

  // 启动综合监控定时器（包含分组、标签组排序和组内标签排序）
  if (settings.autoGroupInterval > 0) {
    // 设置下一次执行时间
    nextExecutionTime = Date.now() + settings.autoGroupInterval;
    console.log('下一次执行时间:', new Date(nextExecutionTime).toLocaleString());

    // 立即执行一次自动监控任务
    executeMonitoringTask();

    // 设置定时器定期执行
    autoGroupTimerId = setInterval(async () => {
      console.log('定时器触发，准备执行自动监控任务');
      console.log('当前时间:', new Date().toLocaleString());
      console.log('下一次执行时间:', new Date(nextExecutionTime).toLocaleString());

      // 更新下一次执行时间
      nextExecutionTime = Date.now() + settings.autoGroupInterval;

      if (settings.extensionActive && !isManualUngrouping()) {
        executeMonitoringTask();
      }
    }, settings.autoGroupInterval);
    console.log('自动监控定时器已启动，间隔:', settings.autoGroupInterval, 'ms');
  }
}

/**
 * 停止持续监控
 */
function stopContinuousMonitoring() {
  console.log('停止持续监控');

  // 清除自动监控定时器
  if (autoGroupTimerId) {
    clearInterval(autoGroupTimerId);
    autoGroupTimerId = null;
    console.log('自动监控定时器已停止');
  }

  // 重置下一次执行时间
  nextExecutionTime = 0;
}

/**
 * 根据设置更新监控状态
 */
function updateMonitoringStatus() {
  console.log('更新监控状态，当前设置:', {
    monitoringEnabled: settings.monitoringEnabled,
    extensionActive: settings.extensionActive,
    autoGroupInterval: settings.autoGroupInterval,
    autoGroupByDomain: settings.autoGroupByDomain,
    enableGroupSorting: settings.enableGroupSorting,
    enableTabSorting: settings.enableTabSorting
  });

  // 无论如何先停止现有的监控
  stopContinuousMonitoring();

  // 如果启用了监控且扩展处于激活状态，则启动监控
  if (settings.monitoringEnabled && settings.extensionActive) {
    console.log('监控已启用且扩展处于激活状态，启动持续监控');
    startContinuousMonitoring();
  } else {
    console.log('监控未启用或扩展未激活，不启动持续监控');
    if (!settings.monitoringEnabled) {
      console.log('原因: 监控未启用');
    }
    if (!settings.extensionActive) {
      console.log('原因: 扩展未激活');
    }
  }
}

/**
 * 获取下一次执行时间
 * @returns {number} 下一次执行时间的时间戳
 */
function getNextExecutionTime() {
  return nextExecutionTime;
}

// 导出函数
export {
  executeMonitoringTask,
  startContinuousMonitoring,
  stopContinuousMonitoring,
  updateMonitoringStatus,
  getNextExecutionTime
};
