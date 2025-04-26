/**
 * 标签组排序单元测试
 */

import { sortTabGroups } from '../../js/group-sorting.js';
import chromeMock, { resetChromeApiMocks } from '../mocks/chrome-api-mock';
import { mockTabGroups } from '../mocks/test-data';
import { settings } from '../../js/settings.js';

describe('Group Sorting 模块', () => {
  beforeEach(() => {
    // 清除所有模拟调用记录
    jest.clearAllMocks();
    resetChromeApiMocks();
    
    // 初始化设置
    settings.groupSortingMethod = 'title';
    settings.groupSortOrder = 'asc';
    
    // 模拟获取标签组
    chromeMock.tabGroups.query.mockImplementation((queryInfo, callback) => {
      if (callback) {
        callback(mockTabGroups);
      }
      return Promise.resolve(mockTabGroups);
    });
    
    // 模拟移动标签组 - 必须返回一个Promise
    chromeMock.tabGroups.move.mockImplementation((groupId, moveProperties) => {
      return Promise.resolve({ id: groupId });
    });
    
    // 模拟标签查询，为大小排序测试准备数据
    chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
      let result = [];
      if (queryInfo.groupId === 1) {
        result = [{ id: 1 }, { id: 2 }]; // 组1有2个标签
      } else if (queryInfo.groupId === 2) {
        result = [{ id: 3 }]; // 组2有1个标签
      }
      
      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    });
  });
  
  afterEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('sortTabGroups 函数', () => {
    test('应该对标签组进行排序', async () => {
      const result = await sortTabGroups();
      
      // 验证是否调用了tabGroups.query
      expect(chromeMock.tabGroups.query).toHaveBeenCalledWith(
        { windowId: chrome.windows.WINDOW_ID_CURRENT },
        expect.any(Function)
      );
      
      // 验证是否调用了tabGroups.move
      expect(chromeMock.tabGroups.move).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('应该处理没有标签组的情况', async () => {
      // 模拟没有标签组的情况
      chromeMock.tabGroups.query.mockImplementation((queryInfo, callback) => {
        if (callback) callback([]);
        return Promise.resolve([]);
      });
      
      const result = await sortTabGroups();
      
      // 验证是否调用了tabGroups.query
      expect(chromeMock.tabGroups.query).toHaveBeenCalled();
      
      // 验证没有调用tabGroups.move
      expect(chromeMock.tabGroups.move).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    test('应该使用不同的排序方法', async () => {
      // 测试标题排序
      settings.groupSortingMethod = 'title';
      await sortTabGroups();
      expect(chromeMock.tabGroups.move).toHaveBeenCalled();
      
      // 清除之前的调用记录
      chromeMock.tabGroups.move.mockClear();
      
      // 测试大小排序
      settings.groupSortingMethod = 'size';
      await sortTabGroups();
      expect(chromeMock.tabGroups.move).toHaveBeenCalled();
      
      // 清除之前的调用记录
      chromeMock.tabGroups.move.mockClear();
      
      // 测试智能排序
      settings.groupSortingMethod = 'smart';
      await sortTabGroups();
      expect(chromeMock.tabGroups.move).toHaveBeenCalled();
    });
    
    test('应该支持不同的排序顺序', async () => {
      // 测试升序排序
      settings.groupSortOrder = 'asc';
      await sortTabGroups();
      expect(chromeMock.tabGroups.move).toHaveBeenCalled();
      
      // 清除之前的调用记录
      chromeMock.tabGroups.move.mockClear();
      
      // 测试降序排序
      settings.groupSortOrder = 'desc';
      await sortTabGroups();
      expect(chromeMock.tabGroups.move).toHaveBeenCalled();
    });
  });
}); 