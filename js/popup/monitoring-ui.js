/**
 * 监控UI管理模块
 */

import { getMessage, showStatus } from './utils.js';

/**
 * 初始化监控UI
 * @param {HTMLElement} extensionActiveToggle - 扩展激活开关
 * @param {HTMLElement} extensionActiveStatus - 扩展激活状态
 * @param {HTMLElement} monitoringToggle - 监控开关
 * @param {HTMLElement} monitoringStatus - 监控状态
 * @param {HTMLElement} monitoringInterval - 监控间隔输入
 * @param {HTMLElement} monitoringCountdown - 监控倒计时
 */
function initMonitoringUI(
  extensionActiveToggle, extensionActiveStatus,
  monitoringToggle, monitoringStatus,
  monitoringInterval, monitoringCountdown
) {
  // 获取当前设置
  chrome.runtime.sendMessage({ action: 'getExtensionStatus' }, (response) => {
    if (response && response.success) {
      // 设置扩展激活状态
      extensionActiveToggle.checked = response.active;
      updateStatusDisplay(extensionActiveStatus, response.active);

      // 设置监控状态
      if (response.settings) {
        monitoringToggle.checked = response.settings.monitoringEnabled;
        updateStatusDisplay(monitoringStatus, response.settings.monitoringEnabled);

        // 设置监控间隔
        if (response.settings.autoGroupInterval) {
          monitoringInterval.value = response.settings.autoGroupInterval / 1000;
        }
      }
    }
  });

  // 添加扩展激活开关事件
  extensionActiveToggle.addEventListener('change', () => {
    const active = extensionActiveToggle.checked;
    chrome.runtime.sendMessage({
      action: 'toggleExtensionActive',
      active: active
    }, (response) => {
      if (response && response.success) {
        updateStatusDisplay(extensionActiveStatus, response.active);
        showStatus(
          active ? getMessage('extensionActivated') : getMessage('extensionDeactivated'),
          active ? 'success' : 'info'
        );
      }
    });
  });

  // 添加监控开关事件
  monitoringToggle.addEventListener('change', () => {
    const enabled = monitoringToggle.checked;
    chrome.runtime.sendMessage({
      action: 'toggleMonitoring',
      enabled: enabled
    }, (response) => {
      if (response && response.success) {
        updateStatusDisplay(monitoringStatus, response.monitoringEnabled);
        showStatus(
          enabled ? getMessage('monitoringEnabled') : getMessage('monitoringDisabled'),
          enabled ? 'success' : 'info'
        );

        // 如果启用了监控，立即更新倒计时
        if (enabled) {
          getNextExecutionTimeAndUpdateCountdown(monitoringCountdown);
        } else {
          monitoringCountdown.textContent = '--:--';
        }
      }
    });
  });

  // 添加监控间隔变更事件
  monitoringInterval.addEventListener('change', () => {
    const interval = parseInt(monitoringInterval.value);
    if (isNaN(interval) || interval < 1) {
      showStatus(getMessage('invalidInterval'), 'error');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'updateMonitoringInterval',
      interval: interval * 1000
    }, (response) => {
      if (response && response.success) {
        showStatus(getMessage('intervalUpdated'), 'success');
        // 更新倒计时
        getNextExecutionTimeAndUpdateCountdown(monitoringCountdown);
      }
    });
  });

  // 初始化倒计时
  getNextExecutionTimeAndUpdateCountdown(monitoringCountdown);
}

/**
 * 更新状态显示
 * @param {HTMLElement} statusElement - 状态元素
 * @param {boolean} active - 是否激活
 */
function updateStatusDisplay(statusElement, active) {
  statusElement.textContent = active ? getMessage('active') : getMessage('inactive');
  statusElement.className = active ? 'status-active' : 'status-inactive';
}

/**
 * 获取下一次执行时间并更新倒计时
 * @param {HTMLElement} countdownElement - 倒计时元素
 */
function getNextExecutionTimeAndUpdateCountdown(countdownElement) {
  chrome.runtime.sendMessage({ action: 'getNextExecutionTime' }, (response) => {
    if (response && response.success) {
      // 检查是否启用了监控
      if (!response.monitoringEnabled || !response.extensionActive) {
        countdownElement.textContent = '--:--';
        return;
      }

      // 获取下一次执行时间
      const nextExecutionTime = response.nextExecutionTime;
      if (!nextExecutionTime) {
        countdownElement.textContent = '--:--';
        return;
      }

      // 计算剩余时间
      const now = Date.now();
      let remainingTime = nextExecutionTime - now;

      // 检查时间是否有效
      if (remainingTime < 0 || remainingTime > 3600000) { // 如果是过去的时间或超过1小时
        console.warn('无效的下一次执行时间:', new Date(nextExecutionTime).toLocaleString());
        countdownElement.textContent = '--:--';
        return;
      }

      // 更新倒计时
      updateCountdown(countdownElement, remainingTime);

      // 设置定时器，每秒更新一次倒计时
      const countdownInterval = setInterval(() => {
        remainingTime -= 1000;
        if (remainingTime <= 0) {
          clearInterval(countdownInterval);
          // 重新获取下一次执行时间
          setTimeout(() => {
            getNextExecutionTimeAndUpdateCountdown(countdownElement);
          }, 1000);
        } else {
          updateCountdown(countdownElement, remainingTime);
        }
      }, 1000);
    }
  });
}

/**
 * 更新倒计时显示
 * @param {HTMLElement} countdownElement - 倒计时元素
 * @param {number} remainingTime - 剩余时间（毫秒）
 */
function updateCountdown(countdownElement, remainingTime) {
  const seconds = Math.floor((remainingTime / 1000) % 60);
  const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);

  countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 导出函数
export {
  initMonitoringUI,
  getNextExecutionTimeAndUpdateCountdown
};
