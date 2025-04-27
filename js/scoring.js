/**
 * 统一的排序评分逻辑模块
 *
 * 这个模块提供了统一的标签页和标签组评分函数，
 * 确保在整个应用中使用相同的评分算法。
 */

import { extractDomain } from './utils.js';

/**
 * 排序算法详情
 */
const SCORING_ALGORITHMS = {
  // 标签页排序算法
  tab: {
    title: {
      name: '按标题排序',
      description: '根据标签页的标题按字母顺序排序',
      formula: '直接使用标签页标题作为排序依据',
      factors: []
    },
    domain: {
      name: '按域名排序',
      description: '根据标签页的域名按字母顺序排序',
      formula: '直接使用标签页URL的域名部分作为排序依据',
      factors: []
    },
    smart: {
      name: '智能排序',
      description: '综合考虑多个因素进行智能排序',
      formula: 'score = (urlScore * 0.4) + (titleScore * 0.4) + (domainScore * 0.2)',
      factors: [
        { name: 'URL长度', weight: 0.4, calculation: 'min(url.length / 100, 1)' },
        { name: '标题长度', weight: 0.4, calculation: 'min(title.length / 50, 1)' },
        { name: '域名长度', weight: 0.2, calculation: 'domain.length / 20' }
      ]
    }
  },
  // 标签组排序算法
  group: {
    title: {
      name: '按标题排序',
      description: '根据标签组的标题按字母顺序排序',
      formula: '直接使用标签组标题作为排序依据',
      factors: []
    },
    size: {
      name: '按大小排序',
      description: '根据标签组内的标签数量排序',
      formula: '直接使用标签组内的标签数量作为排序依据',
      factors: []
    },
    smart: {
      name: '智能排序',
      description: '综合考虑多个因素进行智能排序',
      formula: 'score = (accessScore * 0.5) + (sizeScore * 0.3) + (createScore * 0.2)',
      factors: [
        { name: '访问时间', weight: 0.5, calculation: '固定值0.5（实际应用中应基于真实访问时间）' },
        { name: '标签数量', weight: 0.3, calculation: 'min(size / 10, 1)' },
        { name: '创建时间', weight: 0.2, calculation: '固定值0.5（实际应用中应基于真实创建时间）' }
      ]
    }
  }
};

/**
 * 计算标签页的排序分数
 * @param {Object} tab - 标签页对象
 * @param {string} sortMethod - 排序方法 ('title', 'domain', 'smart', 或其他)
 * @returns {string|number} 排序分数
 */
export function calculateTabScore(tab, sortMethod) {
  let score;

  if (sortMethod === 'title') {
    // 按标题排序
    score = tab.title || '';
  } else if (sortMethod === 'domain') {
    // 按域名排序
    score = extractDomain(tab.url || '');
  } else if (sortMethod === 'smart') {
    // 智能排序（结合多个因素）
    // 使用稳定的计算方法，避免随机性
    const urlScore = tab.url ? Math.min(tab.url.length / 100, 1) : 0; // URL长度分数
    const titleScore = tab.title ? Math.min(tab.title.length / 50, 1) : 0; // 标题长度分数
    const domainScore = tab.url ? extractDomain(tab.url).length / 20 : 0; // 域名长度分数

    // 加权平均
    score = (urlScore * 0.4) + (titleScore * 0.4) + (domainScore * 0.2);

    // 保留两位小数，确保一致性
    score = parseFloat(score.toFixed(2));
  } else {
    // 默认按索引排序
    score = tab.index;
  }

  return score;
}

/**
 * 计算标签组的排序分数
 * @param {Object} group - 标签组对象
 * @param {Array} tabs - 组内标签页数组
 * @param {string} sortMethod - 排序方法 ('title', 'size', 'smart', 或其他)
 * @returns {string|number} 排序分数
 */
export function calculateGroupScore(group, tabs, sortMethod) {
  let score;

  if (sortMethod === 'title') {
    // 按标题排序
    score = group.title || '';
  } else if (sortMethod === 'size') {
    // 按大小排序
    score = tabs.length;
  } else if (sortMethod === 'smart') {
    // 智能排序（基于标签页数量和其他因素）
    const size = tabs.length;
    const sizeScore = Math.min(size / 10, 1); // 最多10个标签页得满分

    // 使用稳定的计算方法，避免随机性
    // 在实际应用中，应该使用真实的访问时间和创建时间数据
    // 这里我们主要使用标签页数量作为主要因素
    const accessWeight = 0.5;
    const sizeWeight = 0.3;
    const createWeight = 0.2;

    // 为了保持一致性，我们使用固定的访问分数和创建分数
    // 在实际应用中，这些应该基于真实数据
    const accessScore = 0.5; // 固定值，避免随机性
    const createScore = 0.5; // 固定值，避免随机性

    score = (
      accessScore * accessWeight +
      sizeScore * sizeWeight +
      createScore * createWeight
    );

    // 保留两位小数，确保一致性
    score = parseFloat(score.toFixed(2));
  } else {
    // 默认使用标签页数量
    score = tabs.length;
  }

  return score;
}

/**
 * 根据分数对标签页进行排序
 * @param {Array} tabs - 标签页数组
 * @param {Object} tabScores - 标签页ID到分数的映射
 * @param {boolean} sortAscending - 是否升序排序
 * @returns {Array} 排序后的标签页数组
 */
export function sortTabsByScore(tabs, tabScores, sortAscending) {
  return [...tabs].sort((a, b) => {
    const scoreA = tabScores[a.id];
    const scoreB = tabScores[b.id];

    if (typeof scoreA === 'string' && typeof scoreB === 'string') {
      // 字符串比较
      return sortAscending ?
        scoreA.localeCompare(scoreB) :
        scoreB.localeCompare(scoreA);
    } else {
      // 数值比较
      return sortAscending ?
        scoreA - scoreB :
        scoreB - scoreA;
    }
  });
}

/**
 * 根据分数对标签组进行排序
 * @param {Array} groups - 标签组数组
 * @param {Object} groupScores - 标签组ID到分数的映射
 * @param {boolean} sortAscending - 是否升序排序
 * @returns {Array} 排序后的标签组数组
 */
export function sortGroupsByScore(groups, groupScores, sortAscending) {
  return [...groups].sort((a, b) => {
    const scoreA = groupScores[a.id];
    const scoreB = groupScores[b.id];

    if (typeof scoreA === 'string' && typeof scoreB === 'string') {
      // 字符串比较
      return sortAscending ?
        String(scoreA).localeCompare(String(scoreB)) :
        String(scoreB).localeCompare(String(scoreA));
    } else {
      // 数值比较
      return sortAscending ?
        scoreA - scoreB :
        scoreB - scoreA;
    }
  });
}

/**
 * 获取标签页排序算法详情
 * @param {string} sortMethod - 排序方法
 * @returns {Object} 算法详情
 */
export function getTabScoringAlgorithmDetails(sortMethod) {
  return SCORING_ALGORITHMS.tab[sortMethod] || {
    name: `未知排序方法: ${sortMethod}`,
    description: '没有关于此排序方法的详细信息',
    formula: '未知',
    factors: []
  };
}

/**
 * 获取标签组排序算法详情
 * @param {string} sortMethod - 排序方法
 * @returns {Object} 算法详情
 */
export function getGroupScoringAlgorithmDetails(sortMethod) {
  return SCORING_ALGORITHMS.group[sortMethod] || {
    name: `未知排序方法: ${sortMethod}`,
    description: '没有关于此排序方法的详细信息',
    formula: '未知',
    factors: []
  };
}

/**
 * 获取标签页的详细评分信息
 * @param {Object} tab - 标签页对象
 * @param {string} sortMethod - 排序方法
 * @returns {Object} 详细评分信息
 */
export function getTabScoringDetails(tab, sortMethod) {
  const result = {
    finalScore: calculateTabScore(tab, sortMethod),
    method: sortMethod,
    factors: []
  };

  if (sortMethod === 'title') {
    result.factors.push({
      name: '标题',
      value: tab.title || '',
      score: tab.title || '',
      weight: 1
    });
  } else if (sortMethod === 'domain') {
    const domain = extractDomain(tab.url || '');
    result.factors.push({
      name: '域名',
      value: domain,
      score: domain,
      weight: 1
    });
  } else if (sortMethod === 'smart') {
    const urlScore = tab.url ? Math.min(tab.url.length / 100, 1) : 0;
    const titleScore = tab.title ? Math.min(tab.title.length / 50, 1) : 0;
    const domainScore = tab.url ? extractDomain(tab.url).length / 20 : 0;

    result.factors.push({
      name: 'URL长度',
      value: tab.url ? tab.url.length : 0,
      score: urlScore.toFixed(2),
      weight: 0.4
    });
    result.factors.push({
      name: '标题长度',
      value: tab.title ? tab.title.length : 0,
      score: titleScore.toFixed(2),
      weight: 0.4
    });
    result.factors.push({
      name: '域名长度',
      value: tab.url ? extractDomain(tab.url).length : 0,
      score: domainScore.toFixed(2),
      weight: 0.2
    });
  }

  return result;
}

/**
 * 获取标签组的详细评分信息
 * @param {Object} group - 标签组对象
 * @param {Array} tabs - 组内标签页数组
 * @param {string} sortMethod - 排序方法
 * @returns {Object} 详细评分信息
 */
export function getGroupScoringDetails(group, tabs, sortMethod) {
  const result = {
    finalScore: calculateGroupScore(group, tabs, sortMethod),
    method: sortMethod,
    factors: []
  };

  if (sortMethod === 'title') {
    result.factors.push({
      name: '标题',
      value: group.title || '',
      score: group.title || '',
      weight: 1
    });
  } else if (sortMethod === 'size') {
    result.factors.push({
      name: '标签数量',
      value: tabs.length,
      score: tabs.length,
      weight: 1
    });
  } else if (sortMethod === 'smart') {
    const size = tabs.length;
    const sizeScore = Math.min(size / 10, 1);
    const accessScore = 0.5; // 固定值
    const createScore = 0.5; // 固定值

    result.factors.push({
      name: '访问时间',
      value: '固定值',
      score: accessScore.toFixed(2),
      weight: 0.5
    });
    result.factors.push({
      name: '标签数量',
      value: size,
      score: sizeScore.toFixed(2),
      weight: 0.3
    });
    result.factors.push({
      name: '创建时间',
      value: '固定值',
      score: createScore.toFixed(2),
      weight: 0.2
    });
  }

  return result;
}
