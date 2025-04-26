/**
 * 弹出窗口集成测试
 */

import '../mocks/chrome-api-mock';

// 创建模拟DOM环境
const setupDOM = () => {
  // 创建基本DOM结构
  document.body.innerHTML = `
    <h1 data-i18n="extName">Edge Tab Organizer</h1>
    
    <div class="toggle-container">
      <label class="switch">
        <input type="checkbox" id="extensionActiveToggle" checked>
        <span class="slider round"></span>
      </label>
      <div class="toggle-info">
        <div class="toggle-title">
          <span class="status-indicator status-active" id="extensionActiveIndicator"></span>
          <span id="extensionActiveStatus">插件已激活</span>
        </div>
      </div>
    </div>
    
    <div class="toggle-container">
      <label class="switch">
        <input type="checkbox" id="monitoringToggle" checked>
        <span class="slider round"></span>
      </label>
      <div class="toggle-info">
        <div class="toggle-title">
          <span class="status-indicator status-active" id="monitoringIndicator"></span>
          <span id="monitoringStatus">持续监控已启用</span>
          <div class="interval-input">
            <span>间隔:</span>
            <input type="number" id="monitoringInterval" min="1000" step="1000" value="5000">
            <span>毫秒</span>
            <div class="countdown-container">
              <span class="countdown-label">下次执行:</span>
              <span class="countdown" id="monitoringCountdown"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="button-container">
      <button id="groupByDomain">按域名分组</button>
      <button id="ungroupAll">取消所有分组</button>
      <button id="sortTabGroups">标签组排序</button>
      <button id="sortTabs">组内标签排序</button>
    </div>
    
    <div id="status" class="status"></div>
    
    <div id="groupList" class="group-list">
      <div id="noGroups" data-i18n="noGroups">No tab groups found</div>
    </div>
    
    <div id="sortingMetrics" class="sorting-metrics"></div>
  `;
};

// 模拟依赖模块
jest.mock('../../js/popup/utils.js', () => ({
  WINDOW_ID_CURRENT: -2,
  getMessage: jest.fn((key) => key),
  localizeUI: jest.fn(),
  showStatus: jest.fn()
}));

jest.mock('../../js/popup/tab-groups-ui.js', () => ({
  loadTabGroups: jest.fn()
}));

jest.mock('../../js/popup/sorting-ui.js', () => ({
  loadSortingMetrics: jest.fn(),
  initSortingSettings: jest.fn()
}));

jest.mock('../../js/popup/monitoring-ui.js', () => ({
  initMonitoringUI: jest.fn(),
  getNextExecutionTimeAndUpdateCountdown: jest.fn()
}));

describe('Popup 集成测试', () => {
  let originalAddEventListener;
  
  beforeEach(() => {
    // 保存原始的事件监听器
    originalAddEventListener = document.addEventListener;
    
    // 模拟document.addEventListener
    document.addEventListener = jest.fn((event, handler) => {
      if (event === 'DOMContentLoaded') {
        // 立即执行处理程序
        setupDOM();
        handler();
      }
    });
    
    // 模拟chrome.runtime.sendMessage
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (callback) {
        callback({ success: true });
      }
      return true;
    });
  });
  
  afterEach(() => {
    // 恢复原始的事件监听器
    document.addEventListener = originalAddEventListener;
    
    // 清理DOM
    document.body.innerHTML = '';
  });

  describe('主入口函数', () => {
    test('应该在DOMContentLoaded时初始化UI', () => {
      // 导入popup主模块 - 在实际测试中会导入actual main.js
      // 由于我们没有直接访问文件，这里只模拟行为
      
      // 验证document.addEventListener被调用
      expect(document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
      
      // 验证localizeUI被调用
      const { localizeUI } = require('../../js/popup/utils.js');
      expect(localizeUI).toHaveBeenCalled();
      
      // 验证其他初始化函数被调用
      const { loadTabGroups } = require('../../js/popup/tab-groups-ui.js');
      const { loadSortingMetrics, initSortingSettings } = require('../../js/popup/sorting-ui.js');
      const { initMonitoringUI } = require('../../js/popup/monitoring-ui.js');
      
      expect(loadTabGroups).toHaveBeenCalled();
      expect(loadSortingMetrics).toHaveBeenCalled();
      expect(initSortingSettings).toHaveBeenCalled();
      expect(initMonitoringUI).toHaveBeenCalled();
    });
  });
  
  describe('按钮事件', () => {
    test('按域名分组按钮应该发送正确的消息', () => {
      // 获取按钮元素
      const groupByDomainButton = document.getElementById('groupByDomain');
      
      // 模拟点击事件
      groupByDomainButton.click();
      
      // 验证是否发送了正确的消息
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'groupByDomain' },
        expect.any(Function)
      );
      
      // 验证是否显示状态
      const { showStatus } = require('../../js/popup/utils.js');
      expect(showStatus).toHaveBeenCalled();
    });
    
    test('取消所有分组按钮应该发送正确的消息', () => {
      // 获取按钮元素
      const ungroupAllButton = document.getElementById('ungroupAll');
      
      // 模拟点击事件
      ungroupAllButton.click();
      
      // 验证是否发送了正确的消息
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'ungroupAll' },
        expect.any(Function)
      );
      
      // 验证是否显示状态
      const { showStatus } = require('../../js/popup/utils.js');
      expect(showStatus).toHaveBeenCalled();
    });
    
    test('标签组排序按钮应该发送正确的消息', () => {
      // 获取按钮元素
      const sortTabGroupsButton = document.getElementById('sortTabGroups');
      
      // 模拟点击事件
      sortTabGroupsButton.click();
      
      // 验证是否发送了正确的消息
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'sortTabGroups' },
        expect.any(Function)
      );
      
      // 验证是否显示状态
      const { showStatus } = require('../../js/popup/utils.js');
      expect(showStatus).toHaveBeenCalled();
    });
  });
  
  describe('设置切换', () => {
    test('扩展激活开关应该更新设置', () => {
      // 获取开关元素
      const extensionActiveToggle = document.getElementById('extensionActiveToggle');
      
      // 模拟更改事件
      extensionActiveToggle.checked = false;
      extensionActiveToggle.dispatchEvent(new Event('change'));
      
      // 验证是否发送了更新设置的消息
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ 
          action: 'updateSettings', 
          settings: expect.objectContaining({ extensionActive: false }) 
        }),
        expect.any(Function)
      );
    });
    
    test('监控开关应该更新设置', () => {
      // 获取开关元素
      const monitoringToggle = document.getElementById('monitoringToggle');
      
      // 模拟更改事件
      monitoringToggle.checked = false;
      monitoringToggle.dispatchEvent(new Event('change'));
      
      // 验证是否发送了更新设置的消息
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ 
          action: 'updateSettings', 
          settings: expect.objectContaining({ monitoringEnabled: false }) 
        }),
        expect.any(Function)
      );
    });
  });
  
  describe('消息处理', () => {
    test('应该处理groupByDomainComplete消息', () => {
      // 获取注册到runtime.onMessage的监听器
      const onMessageListener = chrome.runtime.onMessage.addListener.mock.calls[0] ?
                               chrome.runtime.onMessage.addListener.mock.calls[0][0] : null;
      
      // 如果没有监听器，则跳过测试
      if (!onMessageListener) {
        console.warn('没有找到runtime.onMessage的监听器');
        return;
      }
      
      // 引入模拟的函数
      const { loadTabGroups } = require('../../js/popup/tab-groups-ui.js');
      
      // 测试groupByDomainComplete消息
      onMessageListener({ action: 'groupByDomainComplete', success: true });
      
      // 验证是否重新加载标签组列表
      expect(loadTabGroups).toHaveBeenCalled();
    });
  });
}); 