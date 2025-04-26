/**
 * 工具函数单元测试
 */

import { 
  extractDomain, 
  getDomainForGrouping, 
  getColorForDomain,
  WINDOW_ID_CURRENT,
  TAB_GROUP_ID_NONE,
  baseColors
} from '../../js/utils';

describe('Utils 模块', () => {
  describe('常量检查', () => {
    test('常量值应该正确', () => {
      expect(WINDOW_ID_CURRENT).toBe(chrome.windows.WINDOW_ID_CURRENT);
      expect(TAB_GROUP_ID_NONE).toBe(-1);
      expect(baseColors).toContain('blue');
      expect(baseColors).toContain('red');
      expect(baseColors.length).toBeGreaterThan(0);
    });
  });

  describe('extractDomain 函数', () => {
    test('应该从有效URL中提取域名', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
      expect(extractDomain('http://sub.example.com')).toBe('sub.example.com');
      expect(extractDomain('https://example.com')).toBe('example.com');
    });

    test('应该处理无效URL并返回空字符串', () => {
      expect(extractDomain('invalid-url')).toBe('');
      expect(extractDomain('')).toBe('');
    });
  });

  describe('getDomainForGrouping 函数', () => {
    test('应该提取主域名部分', () => {
      expect(getDomainForGrouping('https://www.google.com')).toBe('google');
      expect(getDomainForGrouping('https://mail.google.com')).toBe('google');
      expect(getDomainForGrouping('https://developer.mozilla.org')).toBe('mozilla');
    });

    test('应该正确处理特殊域名', () => {
      expect(getDomainForGrouping('https://username.github.io')).toBe('username');
      expect(getDomainForGrouping('https://example.com.cn')).toBe('example');
    });

    test('应该处理无效URL并返回空字符串', () => {
      expect(getDomainForGrouping('invalid-url')).toBe('');
    });
  });

  describe('getColorForDomain 函数', () => {
    test('应该为相同域名返回相同颜色', () => {
      const color1 = getColorForDomain('google');
      const color2 = getColorForDomain('google');
      expect(color1).toBe(color2);
    });

    test('应该返回baseColors中的颜色', () => {
      const color = getColorForDomain('google');
      expect(baseColors).toContain(color);
    });
    
    test('应该为不同域名可能返回不同颜色', () => {
      // 创建一组不同的域名
      const domains = ['google', 'bing', 'yahoo', 'github', 'mozilla', 'amazon', 'apple', 'facebook'];
      
      // 为每个域名获取颜色
      const colors = new Set();
      domains.forEach(domain => {
        colors.add(getColorForDomain(domain));
      });
      
      // 由于哈希分配机制，不同域名应该至少有两种不同的颜色
      expect(colors.size).toBeGreaterThan(1);
    });
  });
}); 