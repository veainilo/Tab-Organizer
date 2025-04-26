/**
 * 标签分组单元测试
 */

import { 
  groupTabsByDomain, 
  ungroupAllTabs, 
  isManualUngrouping, 
  setManualUngrouping 
} from '../../js/tab-grouping.js';
import chromeMock from '../mocks/chrome-api-mock';
import { mockTabs, mockGroupedTabs, mockTabGroups } from '../mocks/test-data';

describe('Tab Grouping 模块', () => {
  beforeEach(() => {
    // 重置手动取消分组标志
    setManualUngrouping(false);
  });

  describe('groupTabsByDomain 函数', () => {
    beforeEach(() => {
      // 模拟chrome.tabs.query
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        callback(mockTabs);
      });
      
      // 模拟chrome.tabs.group
      chromeMock.tabs.group.mockImplementation((options) => {
        return Promise.resolve(1); // 返回一个模拟的组ID
      });
      
      // 模拟chrome.tabGroups.update
      chromeMock.tabGroups.update.mockImplementation((groupId, updateProperties) => {
        return Promise.resolve();
      });
    });

    test('应该按域名对标签进行分组', async () => {
      await groupTabsByDomain();
      
      // 验证是否调用了tabs.query
      expect(chromeMock.tabs.query).toHaveBeenCalledWith(
        { windowId: chrome.windows.WINDOW_ID_CURRENT },
        expect.any(Function)
      );
      
      // 验证是否调用了tabs.group
      expect(chromeMock.tabs.group).toHaveBeenCalled();
      
      // 验证是否调用了tabGroups.update
      expect(chromeMock.tabGroups.update).toHaveBeenCalled();
    });

    test('应该处理没有标签的情况', async () => {
      // 模拟chrome.tabs.query返回空数组
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([]);
      });
      
      await groupTabsByDomain();
      
      // 验证是否调用了tabs.query
      expect(chromeMock.tabs.query).toHaveBeenCalled();
      
      // 验证没有调用tabs.group
      expect(chromeMock.tabs.group).not.toHaveBeenCalled();
    });
  });
  
  describe('ungroupAllTabs 函数', () => {
    test('应该取消所有标签分组', async () => {
      // 模拟查询结果包含已分组的标签
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        callback(mockGroupedTabs);
      });
      
      // 模拟 chrome.tabs.ungroup
      chromeMock.tabs.ungroup.mockImplementation((tabIds) => {
        return Promise.resolve();
      });
      
      await ungroupAllTabs();
      
      // 验证是否调用了tabs.query
      expect(chromeMock.tabs.query).toHaveBeenCalledWith(
        { windowId: chrome.windows.WINDOW_ID_CURRENT },
        expect.any(Function)
      );
      
      // 验证是否调用了tabs.ungroup
      expect(chromeMock.tabs.ungroup).toHaveBeenCalled();
      
      // 验证是否设置了手动取消分组标志
      expect(isManualUngrouping()).toBe(true);
    });

    test('应该处理所有标签都没有分组的情况', async () => {
      // 模拟查询结果包含未分组的标签
      chromeMock.tabs.query.mockImplementation((queryInfo, callback) => {
        callback(mockTabs); // 所有标签的groupId都是-1
      });
      
      await ungroupAllTabs();
      
      // 验证是否调用了tabs.query
      expect(chromeMock.tabs.query).toHaveBeenCalled();
      
      // 验证没有调用tabs.ungroup
      expect(chromeMock.tabs.ungroup).not.toHaveBeenCalled();
      
      // 即使没有实际取消分组，也应该设置手动取消分组标志
      expect(isManualUngrouping()).toBe(true);
    });
  });
  
  describe('isManualUngrouping 和 setManualUngrouping 函数', () => {
    test('应该正确设置和获取手动取消分组标志', () => {
      // 初始状态应该是false
      expect(isManualUngrouping()).toBe(false);
      
      // 设置为true
      setManualUngrouping(true);
      expect(isManualUngrouping()).toBe(true);
      
      // 设置为false
      setManualUngrouping(false);
      expect(isManualUngrouping()).toBe(false);
    });
    
    test('应该在设置标志为true后自动延时重置', () => {
      setManualUngrouping(true);
      expect(isManualUngrouping()).toBe(true);
      
      // 前进到定时器超时
      jest.advanceTimersByTime(10000); // 假设超时时间是10秒
      
      // 标志应该被重置为false
      expect(isManualUngrouping()).toBe(false);
    });
  });
}); 