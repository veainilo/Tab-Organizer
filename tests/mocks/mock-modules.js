/**
 * 模拟模块实现
 */

// 模拟的设置对象及其方法
export const mockSettings = {
  // 设置对象
  settings: {
    extensionActive: true,
    autoGroupByDomain: true,
    autoGroupOnCreation: true,
    excludeDomains: [],
    monitoringEnabled: true,
    continuousMonitoring: true,
    autoGroupInterval: 5000,
    autoSortInterval: 10000,
    tabSortingMethod: 'domain',
    tabSortOrder: 'asc',
    groupSortingMethod: 'title',
    groupSortOrder: 'asc'
  },

  // 方法
  loadSettings: jest.fn().mockImplementation(async () => {
    return true;
  }),

  saveSettings: jest.fn().mockImplementation(async () => {
    return true;
  }),

  updateSettings: jest.fn().mockImplementation(async (newSettings) => {
    Object.assign(mockSettings.settings, newSettings);
    return true;
  })
};

// 模拟的标签分组方法
export const mockTabGrouping = {
  groupTabsByDomain: jest.fn().mockResolvedValue(true),
  ungroupAllTabs: jest.fn().mockResolvedValue(true),
  isManualUngrouping: jest.fn().mockReturnValue(false),
  setManualUngrouping: jest.fn()
};

// 模拟的标签排序方法
export const mockTabSorting = {
  sortTabsInGroup: jest.fn().mockResolvedValue(true),
  getSortingMetrics: jest.fn().mockResolvedValue({
    totalTabs: 4,
    groupedTabs: 3,
    ungroupedTabs: 1,
    groups: 2
  })
};

// 模拟的标签组排序方法
export const mockGroupSorting = {
  sortTabGroups: jest.fn().mockResolvedValue(true)
};

// 模拟的监控方法
export const mockMonitoring = {
  executeMonitoringTask: jest.fn().mockResolvedValue(true),
  updateMonitoringStatus: jest.fn(),
  getNextExecutionTime: jest.fn().mockReturnValue(Date.now() + 5000)
}; 