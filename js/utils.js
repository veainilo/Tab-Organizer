/**
 * 通用工具函数
 */

// 常量定义
const WINDOW_ID_CURRENT = chrome.windows.WINDOW_ID_CURRENT;
const TAB_GROUP_ID_NONE = -1;

// 可用的标签组颜色
const baseColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

/**
 * 从URL中提取域名
 * @param {string} url - 要提取域名的URL
 * @returns {string} 提取的域名
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return '';
  }
}

/**
 * 根据设置获取用于分组的域名
 * @param {string} url - 要提取域名的URL
 * @returns {string} 用于分组的域名
 */
function getDomainForGrouping(url) {
  const fullDomain = extractDomain(url);
  if (!fullDomain) return '';

  // 提取主域名部分（如cursor, bilibili）
  const parts = fullDomain.split('.');

  // 处理特殊情况，如github.io, github.com等
  if (parts.length >= 2) {
    // 检查是否是二级域名服务，如github.io, xxx.com.cn等
    if ((parts[parts.length - 2] === 'github' && parts[parts.length - 1] === 'io') ||
        (parts[parts.length - 2] === 'com' && parts[parts.length - 1] === 'cn')) {
      // 对于github.io或com.cn这样的情况，返回前一部分
      if (parts.length >= 3) {
        return parts[parts.length - 3];
      }
      return fullDomain;
    }

    // 普通情况，返回次级域名（如cursor, bilibili）
    return parts[parts.length - 2];
  }

  // 如果无法解析，返回完整域名
  return fullDomain;
}

/**
 * 为域名获取颜色
 * @param {string} domain - 域名
 * @returns {string} 颜色名称
 */
function getColorForDomain(domain) {
  // 简化版：使用域名的哈希值来确定颜色
  const hash = domain.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  return baseColors[hash % baseColors.length];
}

// 导出函数
export {
  WINDOW_ID_CURRENT,
  TAB_GROUP_ID_NONE,
  baseColors,
  extractDomain,
  getDomainForGrouping,
  getColorForDomain
};
