/**
 * 弹出窗口工具函数
 */

// 常量定义
const TAB_GROUP_ID_NONE = -1;
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;

/**
 * 获取本地化消息
 * @param {string} messageName - 消息名称
 * @param {Array} substitutions - 替换参数
 * @returns {string} 本地化消息
 */
function getMessage(messageName, substitutions) {
  return chrome.i18n.getMessage(messageName, substitutions);
}

/**
 * 本地化 UI 元素
 */
function localizeUI() {
  // 本地化所有带有 data-i18n 属性的元素
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageName = element.getAttribute('data-i18n');
    element.textContent = getMessage(messageName);
  });

  // 本地化所有带有 data-i18n-placeholder 属性的输入元素
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const messageName = element.getAttribute('data-i18n-placeholder');
    element.placeholder = getMessage(messageName);
  });
}

/**
 * 显示状态消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型（success, error, info）
 */
function showStatus(message, type) {
  const statusElement = document.getElementById('status');
  if (!statusElement) return;
  
  statusElement.textContent = message;
  statusElement.className = 'status';

  if (type === 'success') {
    statusElement.classList.add('success');
  } else if (type === 'error') {
    statusElement.classList.add('error');
  } else if (type === 'info') {
    statusElement.classList.add('info');
  }

  statusElement.style.display = 'block';

  // Hide status after 3 seconds
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

/**
 * 在容器中显示错误消息
 * @param {HTMLElement} container - 容器元素
 * @param {string} errorMessage - 错误消息
 * @param {Error} error - 错误对象
 */
function showErrorInContainer(container, errorMessage, error) {
  console.error(errorMessage, error);

  // 清空容器
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const errorMsg = document.createElement('div');
  errorMsg.className = 'error-message';
  errorMsg.style.padding = '10px';
  errorMsg.style.color = '#e74c3c';
  errorMsg.style.backgroundColor = '#fdeaea';
  errorMsg.style.borderRadius = '4px';
  errorMsg.style.margin = '10px 0';
  errorMsg.textContent = errorMessage + ': ' + (error.message || '未知错误');
  container.appendChild(errorMsg);
}

/**
 * 获取标签组颜色的背景色
 * @param {string} color - 颜色名称
 * @returns {string} 背景色
 */
function getGroupColorBackground(color) {
  const colorMap = {
    'grey': '#f1f3f4',
    'blue': '#d0e8ff',
    'red': '#ffd0d0',
    'yellow': '#fff8d0',
    'green': '#d0ffd0',
    'pink': '#ffd0f0',
    'purple': '#e8d0ff',
    'cyan': '#d0ffff',
    'orange': '#ffe8d0'
  };
  return colorMap[color] || '#f1f3f4';
}

/**
 * 获取标签组颜色的文本色
 * @param {string} color - 颜色名称
 * @returns {string} 文本色
 */
function getGroupColorText(color) {
  const colorMap = {
    'grey': '#444',
    'blue': '#0078d7',
    'red': '#d73a49',
    'yellow': '#b08800',
    'green': '#22863a',
    'pink': '#d03592',
    'purple': '#6f42c1',
    'cyan': '#1b7c83',
    'orange': '#e36209'
  };
  return colorMap[color] || '#444';
}

/**
 * 更新排序顺序按钮
 * @param {HTMLElement} iconElement - 图标元素
 * @param {HTMLElement} textElement - 文本元素
 * @param {boolean} ascending - 是否升序
 */
function updateSortOrderButton(iconElement, textElement, ascending) {
  iconElement.textContent = ascending ? '↑' : '↓';
  textElement.textContent = ascending ? '升序' : '降序';
}

// 导出函数
export {
  TAB_GROUP_ID_NONE,
  WINDOW_ID_CURRENT,
  getMessage,
  localizeUI,
  showStatus,
  showErrorInContainer,
  getGroupColorBackground,
  getGroupColorText,
  updateSortOrderButton
};
