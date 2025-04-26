/**
 * 设置模块单元测试
 */

import { 
  settings, 
  loadSettings, 
  saveSettings, 
  updateSettings 
} from '../../js/settings.js';
import { defaultSettings, updatedSettings } from '../mocks/test-data';
import chromeMock from '../mocks/chrome-api-mock';

describe('Settings 模块', () => {
  beforeEach(() => {
    // 重置设置对象到测试前状态
    Object.keys(settings).forEach(key => {
      delete settings[key];
    });
    
    // 对于每个测试，默认模拟没有存储的设置
    chromeMock.storage.sync.get.mockImplementation((key, callback) => {
      callback({});
    });
  });

  describe('loadSettings 函数', () => {
    test('应该加载默认设置当存储中没有设置时', async () => {
      await loadSettings();
      
      // 验证是否调用了storage.sync.get
      expect(chromeMock.storage.sync.get).toHaveBeenCalledWith(
        'tabOrganizerSettings',
        expect.any(Function)
      );
      
      // 验证是否设置了默认值
      expect(settings.extensionActive).toBe(true);
      expect(settings.autoGroupByDomain).toBe(true);
      expect(Array.isArray(settings.excludeDomains)).toBe(true);
    });
    
    test('应该从存储中加载设置', async () => {
      // 模拟存在已保存的设置
      chromeMock.storage.sync.get.mockImplementation((key, callback) => {
        callback({ tabOrganizerSettings: updatedSettings });
      });
      
      await loadSettings();
      
      // 验证是否从存储中加载了设置
      expect(settings.autoGroupByDomain).toBe(false);
      expect(settings.excludeDomains).toEqual(['example.com']);
    });
  });
  
  describe('saveSettings 函数', () => {
    test('应该将设置保存到存储中', async () => {
      // 设置一些值
      Object.assign(settings, updatedSettings);
      
      // 模拟storage.sync.set
      chromeMock.storage.sync.set.mockImplementation((data, callback) => {
        if (callback) callback();
      });
      
      await saveSettings();
      
      // 验证是否调用了storage.sync.set
      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(
        { tabOrganizerSettings: settings },
        expect.any(Function)
      );
    });
  });
  
  describe('updateSettings 函数', () => {
    test('应该只更新提供的设置并保存到存储中', async () => {
      // 初始化一些默认设置
      Object.assign(settings, defaultSettings);
      
      // 模拟storage.sync.set
      chromeMock.storage.sync.set.mockImplementation((data, callback) => {
        if (callback) callback();
      });
      
      // 更新部分设置
      await updateSettings({
        autoGroupByDomain: false,
        excludeDomains: ['example.com']
      });
      
      // 验证设置是否已更新
      expect(settings.autoGroupByDomain).toBe(false);
      expect(settings.excludeDomains).toEqual(['example.com']);
      
      // 验证其他设置是否保持不变
      expect(settings.extensionActive).toBe(true);
      expect(settings.monitoringEnabled).toBe(true);
      
      // 验证是否调用了storage.sync.set
      expect(chromeMock.storage.sync.set).toHaveBeenCalled();
    });
    
    test('应该处理空更新', async () => {
      // 初始化一些默认设置
      Object.assign(settings, defaultSettings);
      
      // 模拟storage.sync.set
      chromeMock.storage.sync.set.mockImplementation((data, callback) => {
        if (callback) callback();
      });
      
      // 空更新
      await updateSettings({});
      
      // 验证所有设置是否保持不变
      expect(settings).toEqual(defaultSettings);
      
      // 验证是否调用了storage.sync.set
      expect(chromeMock.storage.sync.set).toHaveBeenCalled();
    });
  });
}); 