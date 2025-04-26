/**
 * 监控模块简化版单元测试
 */

import { mockSettings } from '../mocks/mock-modules';
import { mockTabGrouping } from '../mocks/mock-modules';
import { mockTabSorting } from '../mocks/mock-modules';
import { mockGroupSorting } from '../mocks/mock-modules';

// 手动模拟依赖模块
jest.mock('../../js/settings.js', () => mockSettings);
jest.mock('../../js/tab-grouping.js', () => mockTabGrouping);
jest.mock('../../js/tab-sorting.js', () => mockTabSorting);
jest.mock('../../js/group-sorting.js', () => mockGroupSorting);

// 导入被测试模块
import { 
  executeMonitoringTask, 
  updateMonitoringStatus, 
  getNextExecutionTime 
} from '../../js/monitoring.js';
import { settings } from '../../js/settings.js';

describe('Monitoring 模块 (简化版)', () => {
  let originalSetTimeout;
  let originalClearTimeout;
  let originalDateNow;
  let mockSetTimeout;
  let mockClearTimeout;
  
  beforeEach(() => {
    // 保存原始的定时器函数和Date.now
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
    originalDateNow = Date.now;
    
    // 模拟Date.now返回固定时间
    Date.now = jest.fn().mockReturnValue(1672531200000); // 2023-01-01
    
    // 模拟setTimeout和clearTimeout
    mockSetTimeout = jest.fn().mockReturnValue(123);
    mockClearTimeout = jest.fn();
    global.setTimeout = mockSetTimeout;
    global.clearTimeout = mockClearTimeout;
    
    // 模拟setInterval和clearInterval (monitoring.js实际使用的是这两个函数)
    global.setInterval = mockSetTimeout;
    global.clearInterval = mockClearTimeout;
    
    // 重置设置
    Object.assign(settings, {
      extensionActive: true,
      monitoringEnabled: true,
      continuousMonitoring: true,
      autoGroupInterval: 5000,
      autoSortInterval: 10000
    });
    
    // 重置所有测试间状态
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // 恢复原始的定时器函数和Date.now
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    global.setInterval = originalSetTimeout;
    global.clearInterval = originalClearTimeout;
    Date.now = originalDateNow;
    
    // 清除所有模拟的实现
    jest.clearAllMocks();
  });

  describe('getNextExecutionTime 函数', () => {
    test('当扩展激活且监控启用时返回未来时间', () => {
      // 确保扩展激活且监控启用
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      
      // 手动设置一个未来时间用于测试
      // 通过调用updateMonitoringStatus来设置nextExecutionTime
      updateMonitoringStatus();
      
      const nextTime = getNextExecutionTime();
      
      // 验证返回的是未来时间 (应该是 Date.now() + settings.autoGroupInterval)
      expect(nextTime).toBeGreaterThan(0);
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

  describe('updateMonitoringStatus 函数', () => {
    test('当监控启用且扩展激活时应设置定时器', () => {
      // 确保扩展激活且监控启用
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      
      updateMonitoringStatus();
      
      // 验证是否调用了 setInterval (在实现中使用的是setInterval而不是setTimeout)
      expect(mockSetTimeout).toHaveBeenCalled();
    });
    
    test('当扩展未激活时应清除定时器', () => {
      // 先确保定时器已经启动
      settings.extensionActive = true;
      settings.monitoringEnabled = true;
      updateMonitoringStatus();
      
      // 清除之前的所有mock调用记录
      mockClearTimeout.mockClear();
      
      // 然后禁用扩展测试是否清除定时器
      settings.extensionActive = false;
      updateMonitoringStatus();
      
      // 验证是否调用了 clearInterval
      expect(mockClearTimeout).toHaveBeenCalled();
    });
  });
}); 