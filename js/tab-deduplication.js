/**
 * 标签页去重模块
 * 
 * 该模块负责检测并关闭重复的标签页，保留分数较高的标签页
 */

import { calculateTabScore } from './scoring.js';

/**
 * 查找并关闭重复的标签页
 * @param {boolean} autoClose - 是否自动关闭重复标签页
 * @returns {Promise<Object>} 操作结果
 */
export async function deduplicateTabs(autoClose = false) {
  try {
    console.log('开始查找重复标签页...');
    
    // 获取当前窗口的所有标签页
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log(`当前窗口共有 ${tabs.length} 个标签页`);
    
    // 按URL分组
    const tabsByUrl = {};
    for (const tab of tabs) {
      // 忽略没有URL的标签页（如新标签页）
      if (!tab.url || tab.url === 'chrome://newtab/' || tab.url === 'edge://newtab/') {
        continue;
      }
      
      // 使用URL作为键
      const url = tab.url;
      if (!tabsByUrl[url]) {
        tabsByUrl[url] = [];
      }
      tabsByUrl[url].push(tab);
    }
    
    // 找出有重复的URL
    const duplicateUrls = Object.keys(tabsByUrl).filter(url => tabsByUrl[url].length > 1);
    console.log(`找到 ${duplicateUrls.length} 个重复的URL`);
    
    if (duplicateUrls.length === 0) {
      return {
        success: true,
        message: '没有找到重复的标签页',
        duplicates: []
      };
    }
    
    // 处理每个重复的URL
    const duplicateGroups = [];
    const tabsToClose = [];
    
    for (const url of duplicateUrls) {
      const duplicateTabs = tabsByUrl[url];
      console.log(`URL "${url}" 有 ${duplicateTabs.length} 个重复标签页`);
      
      // 计算每个标签页的分数
      const tabScores = {};
      for (const tab of duplicateTabs) {
        // 使用智能排序方法计算分数
        tabScores[tab.id] = calculateTabScore(tab, 'smart');
      }
      
      // 按分数排序（降序）
      const sortedTabs = [...duplicateTabs].sort((a, b) => {
        return tabScores[b.id] - tabScores[a.id];
      });
      
      // 保留分数最高的标签页，其余的可以关闭
      const keepTab = sortedTabs[0];
      const closeTabs = sortedTabs.slice(1);
      
      // 添加到结果中
      duplicateGroups.push({
        url,
        keepTab: {
          id: keepTab.id,
          title: keepTab.title,
          score: tabScores[keepTab.id]
        },
        closeTabs: closeTabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          score: tabScores[tab.id]
        }))
      });
      
      // 如果需要自动关闭，将要关闭的标签页ID添加到列表中
      if (autoClose) {
        tabsToClose.push(...closeTabs.map(tab => tab.id));
      }
    }
    
    // 如果需要自动关闭，关闭重复的标签页
    if (autoClose && tabsToClose.length > 0) {
      console.log(`自动关闭 ${tabsToClose.length} 个重复标签页`);
      await chrome.tabs.remove(tabsToClose);
    }
    
    return {
      success: true,
      message: `找到 ${duplicateUrls.length} 个重复的URL，共 ${tabsToClose.length} 个可关闭的标签页`,
      duplicates: duplicateGroups,
      autoClose
    };
  } catch (error) {
    console.error('去重标签页失败:', error);
    return {
      success: false,
      message: `去重标签页失败: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * 关闭指定的标签页
 * @param {Array<number>} tabIds - 要关闭的标签页ID数组
 * @returns {Promise<Object>} 操作结果
 */
export async function closeTabs(tabIds) {
  try {
    if (!tabIds || tabIds.length === 0) {
      return {
        success: true,
        message: '没有需要关闭的标签页'
      };
    }
    
    console.log(`关闭 ${tabIds.length} 个标签页`);
    await chrome.tabs.remove(tabIds);
    
    return {
      success: true,
      message: `成功关闭 ${tabIds.length} 个标签页`
    };
  } catch (error) {
    console.error('关闭标签页失败:', error);
    return {
      success: false,
      message: `关闭标签页失败: ${error.message}`,
      error: error.message
    };
  }
}
