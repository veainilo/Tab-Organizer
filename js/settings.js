/**
 * 设置管理模块
 */

// 基本设置
let settings = {
  extensionActive: true,          // 默认激活状态
  autoGroupByDomain: true,        // 自动按域名分组
  autoGroupOnCreation: true,      // 创建标签时自动分组
  groupByRootDomain: true,        // 按根域名分组
  ignoreTLD: true,                // 忽略顶级域名
  useDynamicColors: true,         // 使用动态颜色
  enableTabSorting: true,         // 启用标签排序
  sortingMethod: 'smart',         // 标签排序方法（默认智能排序）
  sortAscending: false,           // 标签排序顺序（默认降序）
  enableGroupSorting: true,       // 启用标签组排序
  groupSortingMethod: 'smart',    // 标签组排序方法
  groupSortAscending: true,       // 标签组排序顺序（升序）
  excludeDomains: [],             // 排除的域名
  colorScheme: {                  // 颜色方案
    'default': 'blue'
  },
  // 监控设置
  continuousMonitoring: true,     // 持续监控标签状态
  autoGroupInterval: 5000,        // 自动监控间隔（毫秒）
  autoSortInterval: 10000,        // 自动排序间隔（毫秒）
  monitoringEnabled: true         // 是否启用监控
};

/**
 * 保存设置到存储
 */
function saveSettings() {
  console.log('保存设置到存储:', settings);
  chrome.storage.sync.set({ tabOrganizerSettings: settings }, () => {
    console.log('设置已保存');
  });
}

/**
 * 加载设置
 * @returns {Promise} 加载完成的Promise
 */
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('tabOrganizerSettings', (data) => {
      console.log('Loading settings from storage:', data);
      if (data.tabOrganizerSettings) {
        settings = data.tabOrganizerSettings;
        console.log('Settings loaded:', settings);
      } else {
        console.log('No settings found, using defaults:', settings);
        // 保存默认设置
        saveSettings();
      }
      resolve(settings);
    });
  });
}

/**
 * 更新设置
 * @param {Object} newSettings - 新的设置对象
 */
function updateSettings(newSettings) {
  const oldSettings = {...settings};

  // 更新设置
  Object.assign(settings, newSettings);

  // 保存设置
  saveSettings();

  // 返回旧设置和新设置
  return { oldSettings, newSettings: settings };
}

/**
 * 获取当前设置
 * @returns {Object} 当前设置
 */
function getSettings() {
  return {...settings};
}

// 导出函数和变量
export {
  settings,
  saveSettings,
  loadSettings,
  updateSettings,
  getSettings
};
