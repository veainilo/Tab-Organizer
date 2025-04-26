/**
 * 标签排序单元测试
 */

import { 
  sortTabsInGroup, 
  getSortingMetrics 
} from '../../js/tab-sorting.js';
import chromeMock from '../mocks/chrome-api-mock';
import { mockTabs, mockGroupedTabs, mockTabGroups } from '../mocks/test-data';
import { settings } from '../../js/settings.js';

describe('Tab Sorting 模块', () => {
  beforeEach(() => {
    // 初始化设置
    settings.tabSortingMethod = 'domain';
    settings.tabSortOrder = 'asc';
  });

  describe('sortTabsInGroup 函数', () => {
    beforeEach(() => {
      // 模拟获取标签组中的标签
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        // 模拟标签组1中的标签
        if (queryInfo.groupId === 1) {
          callback([
            { id: 1, url: 'https://mail.google.com', groupId: 1 },
            { id: 2, url: 'https://www.google.com/search', groupId: 1 }
          ]);
        } else {
          callback([]);
        }
      });
      
      // 模拟移动标签
      chromeMock.tabs.move.mockImplementation((tabIds, moveProperties) => {
        return Promise.resolve([{ id: tabIds }]);
      });
    });

    test('应该对标签组中的标签进行排序', async () => {
      await sortTabsInGroup(1);
      
      // 验证是否调用了tabs.query
      expect(chromeMock.tabs.query).toHaveBeenCalledWith(
        { groupId: 1 },
        expect.any(Function)
      );
      
      // 验证是否调用了tabs.move
      expect(chromeMock.tabs.move).toHaveBeenCalled();
    });

    test('应该处理空标签组', async () => {
      // 模拟空标签组
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([]);
      });
      
      await sortTabsInGroup(1);
      
      // 验证是否调用了tabs.query
      expect(chromeMock.tabs.query).toHaveBeenCalled();
      
      // 验证没有调用tabs.move
      expect(chromeMock.tabs.move).not.toHaveBeenCalled();
    });
    
    test('应该使用不同的排序方法', async () => {
      // 测试标题排序
      settings.tabSortingMethod = 'title';
      await sortTabsInGroup(1);
      expect(chromeMock.tabs.move).toHaveBeenCalled();
      
      // 重置模拟
      chromeMock.tabs.move.mockClear();
      
      // 测试智能排序
      settings.tabSortingMethod = 'smart';
      await sortTabsInGroup(1);
      expect(chromeMock.tabs.move).toHaveBeenCalled();
    });
    
    test('应该支持不同的排序顺序', async () => {
      // 测试升序排序
      settings.tabSortOrder = 'asc';
      await sortTabsInGroup(1);
      expect(chromeMock.tabs.move).toHaveBeenCalled();
      
      // 重置模拟
      chromeMock.tabs.move.mockClear();
      
      // 测试降序排序
      settings.tabSortOrder = 'desc';
      await sortTabsInGroup(1);
      expect(chromeMock.tabs.move).toHaveBeenCalled();
    });
  });
  
  describe('getSortingMetrics 函数', () => {
    beforeEach(() => {
      // 模拟获取所有标签
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        callback(mockTabs);
      });
      
      // 模拟获取所有标签组
      chromeMock.tabGroups.query.mockImplementation((queryInfo, callback) => {
        callback(mockTabGroups);
      });
    });

    test('应该返回排序指标', async () => {
      const metrics = await getSortingMetrics();
      
      // 验证是否调用了tabs.query
      expect(chromeMock.tabs.query).toHaveBeenCalled();
      
      // 验证是否调用了tabGroups.query
      expect(chromeMock.tabGroups.query).toHaveBeenCalled();
      
      // 验证返回的指标对象
      expect(metrics).toBeDefined();
      expect(metrics.totalTabs).toBeDefined();
      expect(metrics.groupedTabs).toBeDefined();
      expect(metrics.ungroupedTabs).toBeDefined();
      expect(metrics.groups).toBeDefined();
    });
    
    test('应该处理没有标签或标签组的情况', async () => {
      // 模拟没有标签
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([]);
      });
      
      // 模拟没有标签组
      chromeMock.tabGroups.query.mockImplementation((queryInfo, callback) => {
        callback([]);
      });
      
      const metrics = await getSortingMetrics();
      
      // 验证返回的指标对象
      expect(metrics.totalTabs).toBe(0);
      expect(metrics.groupedTabs).toBe(0);
      expect(metrics.ungroupedTabs).toBe(0);
      expect(metrics.groups).toBe(0);
    });
  });
}); 