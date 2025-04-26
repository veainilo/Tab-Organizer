/**
 * 监控模块单元测试
 */

import { 
  executeMonitoringTask, 
  updateMonitoringStatus, 
  getNextExecutionTime 
} from '../../js/monitoring.js';
import { settings } from '../../js/settings.js';
import chromeMock from '../mocks/chrome-api-mock';

// 模拟 background.js 中导入的函数
jest.mock('../../js/tab-grouping.js', () => ({
  groupTabsByDomain: jest.fn().mockResolvedValue(true),
  ungroupAllTabs: jest.fn().mockResolvedValue(true),
  isManualUngrouping: jest.fn().mockReturnValue(false),
  setManualUngrouping: jest.fn()
}));

jest.mock('../../js/tab-sorting.js', () => ({
  sortTabsInGroup: jest.fn().mockResolvedValue(true),
  getSortingMetrics: jest.fn().mockResolvedValue({
    totalTabs: 4,
    groupedTabs: 3,
    ungroupedTabs: 1,
    groups: 2
  })
}));

jest.mock('../../js/group-sorting.js', () => ({
  sortTabGroups: jest.fn().mockResolvedValue(true)
}));

describe('Monitoring 模块', () => {
  let originalSetTimeout;
  let originalClearTimeout;
  let originalDateNow;
  let mockSetTimeout;
  let mockClearTimeout;
  
  beforeEach(() => {
    // 保存原始的定时器和Date函数
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
    originalDateNow = Date.now;
    
    // 模拟Date.now返回固定时间
    Date.now = jest.fn().mockReturnValue(1672531200000); // 2023-01-01
    
    // 模拟定时器函数
    mockSetTimeout = jest.fn().mockReturnValue(123);
    mockClearTimeout = jest.fn();
    global.setTimeout = mockSetTimeout;
    global.clearTimeout = mockClearTimeout;
    global.setInterval = mockSetTimeout; // monitoring.js使用的是setInterval
    global.clearInterval = mockClearTimeout; // monitoring.js使用的是clearInterval
    
    // 初始化设置
    settings.extensionActive = true;
    settings.monitoringEnabled = true;
    settings.continuousMonitoring = true;
    settings.autoGroupInterval = 5000;
    settings.autoSortInterval = 10000;
    
    // 模拟chrome.tabs.query和chrome.tabGroups.query的实现，避免undefined错误
    chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
      const result = [{ id: 1, title: '测试标签', url: 'https://example.com' }];
      if (callback) callback(result);
      return Promise.resolve(result);
    });
    
    chromeMock.tabGroups.query.mockImplementation((queryInfo, callback) => {
      const result = [{ id: 1, title: '测试组', color: 'blue' }];
      if (callback) callback(result);
      return Promise.resolve(result);
    });
    
    // 清除之前的测试产生的影响
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // 恢复原始的函数
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    global.setInterval = originalSetTimeout;
    global.clearInterval = originalClearTimeout;
    Date.now = originalDateNow;
  });

  describe('executeMonitoringTask 函数', () => {
    test('应该执行分组和排序任务', async () => {
      const { groupTabsByDomain } = require('../../js/tab-grouping.js');
      const { sortTabsInGroup } = require('../../js/tab-sorting.js');
      const { sortTabGroups } = require('../../js/group-sorting.js');
      
      // 确保设置正确
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      settings.autoGroupByDomain = true;
      
      // 确保isManualUngrouping返回false
      const { isManualUngrouping } = require('../../js/tab-grouping.js');
      isManualUngrouping.mockReturnValue(false);
      
      // 执行监控任务
      await executeMonitoringTask();
      
      // 验证是否调用了分组函数
      expect(groupTabsByDomain).toHaveBeenCalled();
      
      // 验证是否调用了排序函数
      expect(sortTabGroups).toHaveBeenCalled();
      expect(sortTabsInGroup).toHaveBeenCalled();
    });
    
    test('当扩展未激活时不应执行任务', async () => {
      const { groupTabsByDomain } = require('../../js/tab-grouping.js');
      
      // 禁用扩展
      settings.extensionActive = false;
      
      await executeMonitoringTask();
      
      // 验证没有调用分组函数
      expect(groupTabsByDomain).not.toHaveBeenCalled();
    });
    
    test('当监控被禁用时不应执行任务', async () => {
      const { groupTabsByDomain } = require('../../js/tab-grouping.js');
      
      // 禁用监控
      settings.monitoringEnabled = false;
      
      await executeMonitoringTask();
      
      // 验证没有调用分组函数
      expect(groupTabsByDomain).not.toHaveBeenCalled();
    });
    
    test('当正在手动取消分组时不应执行任务', async () => {
      const { groupTabsByDomain } = require('../../js/tab-grouping.js');
      const { isManualUngrouping } = require('../../js/tab-grouping.js');
      
      // 模拟正在手动取消分组
      isManualUngrouping.mockReturnValue(true);
      
      await executeMonitoringTask();
      
      // 验证没有调用分组函数
      expect(groupTabsByDomain).not.toHaveBeenCalled();
    });
  });
  
  describe('updateMonitoringStatus 函数', () => {
    test('应该设置监控定时器', () => {
      // 确保扩展激活和监控启用
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      
      updateMonitoringStatus();
      
      // 验证是否调用了 setInterval
      expect(mockSetTimeout).toHaveBeenCalled();
    });
    
    test('当监控被禁用时应该清除定时器', () => {
      // 先启动一次
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      updateMonitoringStatus();
      
      // 清除之前的调用记录
      mockClearTimeout.mockClear();
      
      // 禁用监控
      settings.monitoringEnabled = false;
      
      updateMonitoringStatus();
      
      // 验证是否调用了 clearInterval
      expect(mockClearTimeout).toHaveBeenCalled();
    });
    
    test('当扩展未激活时应该清除定时器', () => {
      // 先启动一次
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      updateMonitoringStatus();
      
      // 清除之前的调用记录
      mockClearTimeout.mockClear();
      
      // 禁用扩展
      settings.extensionActive = false;
      
      updateMonitoringStatus();
      
      // 验证是否调用了 clearInterval
      expect(mockClearTimeout).toHaveBeenCalled();
    });
  });
  
  describe('getNextExecutionTime 函数', () => {
    test('应该返回下次执行时间', () => {
      // 确保扩展激活和监控启用
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      
      // 通过updateMonitoringStatus设置nextExecutionTime
      updateMonitoringStatus();
      
      const nextTime = getNextExecutionTime();
      const now = Date.now();
      
      // 验证返回的是未来时间
      expect(nextTime).toBeGreaterThan(now);
    });
    
    test('当监控被禁用时应该返回0', () => {
      // 禁用监控
      settings.monitoringEnabled = false;
      
      // 重置状态
      updateMonitoringStatus();
      
      const nextTime = getNextExecutionTime();
      
      // 验证返回0
      expect(nextTime).toBe(0);
    });
    
    test('当扩展未激活时应该返回0', () => {
      // 禁用扩展
      settings.extensionActive = false;
      
      // 重置状态
      updateMonitoringStatus();
      
      const nextTime = getNextExecutionTime();
      
      // 验证返回0
      expect(nextTime).toBe(0);
    });
  });
}); 