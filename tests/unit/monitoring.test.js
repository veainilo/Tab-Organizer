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
  
  beforeEach(() => {
    // 保存原始的定时器函数
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
    
    // 初始化设置
    settings.extensionActive = true;
    settings.monitoringEnabled = true;
    settings.continuousMonitoring = true;
    settings.autoGroupInterval = 5000;
    settings.autoSortInterval = 10000;
  });
  
  afterEach(() => {
    // 恢复原始的定时器函数
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  describe('executeMonitoringTask 函数', () => {
    test('应该执行分组和排序任务', async () => {
      const { groupTabsByDomain } = require('../../js/tab-grouping.js');
      const { sortTabsInGroup } = require('../../js/tab-sorting.js');
      const { sortTabGroups } = require('../../js/group-sorting.js');
      
      await executeMonitoringTask();
      
      // 验证是否调用了分组函数
      expect(groupTabsByDomain).toHaveBeenCalled();
      
      // 验证是否调用了排序函数
      expect(sortTabGroups).toHaveBeenCalled();
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
  });
  
  describe('updateMonitoringStatus 函数', () => {
    test('应该设置监控定时器', () => {
      // 模拟 setTimeout
      const mockSetTimeout = jest.fn().mockReturnValue(123);
      global.setTimeout = mockSetTimeout;
      
      updateMonitoringStatus();
      
      // 验证是否调用了 setTimeout
      expect(mockSetTimeout).toHaveBeenCalled();
    });
    
    test('当监控被禁用时应该清除定时器', () => {
      // 模拟 clearTimeout
      const mockClearTimeout = jest.fn();
      global.clearTimeout = mockClearTimeout;
      
      // 禁用监控
      settings.monitoringEnabled = false;
      
      updateMonitoringStatus();
      
      // 验证是否调用了 clearTimeout
      expect(mockClearTimeout).toHaveBeenCalled();
    });
    
    test('当扩展未激活时应该清除定时器', () => {
      // 模拟 clearTimeout
      const mockClearTimeout = jest.fn();
      global.clearTimeout = mockClearTimeout;
      
      // 禁用扩展
      settings.extensionActive = false;
      
      updateMonitoringStatus();
      
      // 验证是否调用了 clearTimeout
      expect(mockClearTimeout).toHaveBeenCalled();
    });
  });
  
  describe('getNextExecutionTime 函数', () => {
    test('应该返回下次执行时间', () => {
      // 模拟当前时间
      const now = new Date();
      jest.spyOn(global, 'Date').mockImplementation(() => now);
      
      const nextTime = getNextExecutionTime();
      
      // 验证返回的是未来时间
      expect(nextTime).toBeGreaterThan(now.getTime());
    });
    
    test('当监控被禁用时应该返回0', () => {
      // 禁用监控
      settings.monitoringEnabled = false;
      
      const nextTime = getNextExecutionTime();
      
      // 验证返回0
      expect(nextTime).toBe(0);
    });
    
    test('当扩展未激活时应该返回0', () => {
      // 禁用扩展
      settings.extensionActive = false;
      
      const nextTime = getNextExecutionTime();
      
      // 验证返回0
      expect(nextTime).toBe(0);
    });
  });
}); 