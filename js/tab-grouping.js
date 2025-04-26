/**
 * 标签分组逻辑模块
 */

import { WINDOW_ID_CURRENT, TAB_GROUP_ID_NONE, getDomainForGrouping, getColorForDomain } from './utils.js';
import { settings } from './settings.js';

// 标志，指示是否是用户手动取消分组
let manualUngrouping = false;

/**
 * 按域名分组标签页
 * @returns {Promise<boolean>} 是否成功
 */
async function groupTabsByDomain() {
  console.log('开始按域名分组标签页');

  try {
    // 获取当前窗口的所有标签页
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs.length, '个');

    if (!tabs || tabs.length === 0) {
      console.log('没有标签页，退出');
      return true;
    }

    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: WINDOW_ID_CURRENT });
    console.log('当前窗口的标签组:', groups.length, '个');

    // 创建域名到组ID的映射
    const domainToGroupId = {};
    for (const group of groups) {
      if (group.title) {
        domainToGroupId[group.title] = group.id;
      }
    }
    console.log('域名到组ID的映射:', domainToGroupId);

    // 按域名分组
    const domainGroups = {};
    const existingGroups = {};

    for (const tab of tabs) {
      if (!tab.url) continue;

      const domain = getDomainForGrouping(tab.url);
      if (!domain || settings.excludeDomains.includes(domain)) continue;

      // 检查标签页是否已经在正确的组中
      if (tab.groupId !== TAB_GROUP_ID_NONE) {
        try {
          const group = await chrome.tabGroups.get(tab.groupId);
          if (group.title === domain) {
            console.log('标签页已在正确的组中:', tab.id, '组:', group.title);
            continue; // 已经在正确的组中，跳过
          }
        } catch (error) {
          console.error('获取标签组信息失败:', error);
        }
      }

      // 检查是否已存在该域名的组
      if (domainToGroupId[domain]) {
        if (!existingGroups[domain]) {
          existingGroups[domain] = [];
        }
        existingGroups[domain].push(tab.id);
      } else {
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab.id);
      }
    }

    console.log('新域名分组结果:', Object.keys(domainGroups).length, '个组');
    console.log('已存在域名分组结果:', Object.keys(existingGroups).length, '个组');

    // 处理已存在的组
    for (const domain in existingGroups) {
      const tabIds = existingGroups[domain];
      if (tabIds.length === 0) continue;

      console.log('添加到已存在的组:', domain, '标签页数量:', tabIds.length);
      await chrome.tabs.group({ tabIds, groupId: domainToGroupId[domain] });
      console.log('标签页已添加到现有组');
    }

    // 创建新的标签组
    for (const domain in domainGroups) {
      const tabIds = domainGroups[domain];
      if (tabIds.length === 0) continue;

      console.log('创建新组:', domain, '标签页数量:', tabIds.length);
      const groupId = await chrome.tabs.group({ tabIds });
      console.log('新组创建成功，ID:', groupId);

      // 设置组标题和颜色
      const color = getColorForDomain(domain);
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: color
      });
      console.log('组标题和颜色已设置');
    }

    console.log('分组完成');
    return true;
  } catch (error) {
    console.error('Error grouping tabs by domain:', error);
    return false;
  }
}

/**
 * 取消所有标签页分组
 * @returns {Promise<Object>} 操作结果
 */
async function ungroupAllTabs() {
  console.log('开始取消所有标签页分组');

  // 如果插件处于激活状态，不允许取消分组
  if (settings.extensionActive) {
    console.log('插件处于激活状态，不允许取消分组');
    return { success: false, error: 'Extension is active, ungrouping is not allowed' };
  }

  // 设置手动取消分组标志，防止自动重新分组
  manualUngrouping = true;

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log('查询到的标签页:', tabs.length, '个');

    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tab.id);
      }
    }

    console.log('取消分组完成');

    // 操作完成后重置标志
    setTimeout(() => {
      manualUngrouping = false;
      console.log('重置手动取消分组标志');
    }, 1000);

    return { success: true };
  } catch (error) {
    console.error('Error ungrouping all tabs:', error);
    // 出错时也重置标志
    manualUngrouping = false;
    return { success: false, error: error.message };
  }
}

/**
 * 获取手动取消分组标志
 * @returns {boolean} 是否正在手动取消分组
 */
function isManualUngrouping() {
  return manualUngrouping;
}

/**
 * 设置手动取消分组标志
 * @param {boolean} value - 标志值
 */
function setManualUngrouping(value) {
  manualUngrouping = value;
}

// 导出函数
export {
  groupTabsByDomain,
  ungroupAllTabs,
  isManualUngrouping,
  setManualUngrouping
};
