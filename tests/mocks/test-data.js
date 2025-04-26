/**
 * 测试数据
 */

// 模拟标签数据
export const mockTabs = [
  { id: 1, url: 'https://www.google.com/search', groupId: -1 },
  { id: 2, url: 'https://mail.google.com', groupId: -1 },
  { id: 3, url: 'https://github.com/repo', groupId: -1 },
  { id: 4, url: 'https://developer.mozilla.org', groupId: -1 }
];

// 模拟已分组的标签
export const mockGroupedTabs = [
  { id: 1, url: 'https://www.google.com/search', groupId: 1 },
  { id: 2, url: 'https://mail.google.com', groupId: 1 },
  { id: 3, url: 'https://github.com/repo', groupId: 2 },
  { id: 4, url: 'https://developer.mozilla.org', groupId: 2 }
];

// 模拟标签组
export const mockTabGroups = [
  { id: 1, title: 'google', color: 'red', windowId: -2 },
  { id: 2, title: 'github', color: 'blue', windowId: -2 }
];

// 默认设置
export const defaultSettings = {
  extensionActive: true,
  autoGroupByDomain: true,
  autoGroupOnCreation: true,
  excludeDomains: [],
  monitoringEnabled: true,
  continuousMonitoring: true,
  autoGroupInterval: 5000,
  autoSortInterval: 10000
};

// 更新的设置
export const updatedSettings = {
  ...defaultSettings,
  autoGroupByDomain: false,
  excludeDomains: ['example.com']
}; 