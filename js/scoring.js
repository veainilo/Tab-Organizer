/**
 * 统一的排序评分逻辑模块
 *
 * 这个模块提供了统一的标签页和标签组评分函数，
 * 确保在整个应用中使用相同的评分算法。
 */

import { extractDomain } from './utils.js';
import { calculateBehaviorScore, calculateGroupBehaviorScore, formatTimeDifference, formatTime, getTabMetadata } from './tab-behavior.js';

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
      description: '综合考虑用户行为和内容特征进行智能排序',
      formula: 'score = (behaviorScore * 0.7) + (contentScore * 0.3)',
      factors: [
        { name: '访问频率', weight: 0.28, calculation: 'min(访问次数 / 20, 1)' },
        { name: '最近访问', weight: 0.28, calculation: '1 - (距今天数 / 7)' },
        { name: '停留时间', weight: 0.14, calculation: 'min(停留分钟 / 30, 1)' },
        { name: 'URL长度', weight: 0.12, calculation: 'min(url.length / 100, 1)' },
        { name: '标题长度', weight: 0.12, calculation: 'min(title.length / 50, 1)' },
        { name: '域名长度', weight: 0.06, calculation: 'domain.length / 20' }
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
      description: '综合考虑组内标签的使用行为和内容特征进行智能排序',
      formula: 'score = (behaviorScore * 0.7) + (contentScore * 0.3)',
      factors: [
        { name: '访问频率', weight: 0.28, calculation: '组内标签平均访问频率' },
        { name: '最近访问', weight: 0.28, calculation: '组内最近访问的标签时间' },
        { name: '停留时间', weight: 0.14, calculation: '组内标签平均停留时间' },
        { name: '标签数量', weight: 0.3, calculation: 'min(size / 10, 1)' }
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
    // 智能排序（结合行为数据和内容特征）

    // 1. 计算行为分数（70%权重）
    const behaviorResult = calculateBehaviorScore(tab);
    const behaviorScore = behaviorResult.finalScore;

    // 2. 计算内容分数（30%权重）
    const urlScore = tab.url ? Math.min(tab.url.length / 100, 1) : 0; // URL长度分数
    const titleScore = tab.title ? Math.min(tab.title.length / 50, 1) : 0; // 标题长度分数
    const domainScore = tab.url ? extractDomain(tab.url).length / 20 : 0; // 域名长度分数

    // 内容特征加权平均
    const contentScore = (urlScore * 0.4) + (titleScore * 0.4) + (domainScore * 0.2);

    // 3. 组合行为分数和内容分数
    score = (behaviorScore * 0.7) + (contentScore * 0.3);

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
    // 智能排序（基于组内标签的行为数据和标签数量）

    // 1. 计算行为分数（70%权重）
    const behaviorResult = calculateGroupBehaviorScore(tabs);
    const behaviorScore = behaviorResult.finalScore;

    // 2. 计算内容分数（主要是标签数量，30%权重）
    const size = tabs.length;
    const sizeScore = Math.min(size / 10, 1); // 最多10个标签页得满分

    // 3. 组合行为分数和内容分数
    score = (behaviorScore * 0.7) + (sizeScore * 0.3);

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
    // 获取行为分数详情
    const behaviorResult = calculateBehaviorScore(tab);
    const behaviorComponents = behaviorResult.components;

    // 添加行为因素
    result.factors.push({
      name: '访问频率',
      value: formatVisitCount(tab.id),
      score: behaviorComponents.accessScore.toFixed(2),
      weight: 0.28
    });

    result.factors.push({
      name: '最近访问',
      value: formatLastVisit(tab.id),
      score: behaviorComponents.recencyScore.toFixed(2),
      weight: 0.28
    });

    result.factors.push({
      name: '停留时间',
      value: formatStayTime(tab.id),
      score: behaviorComponents.timeScore.toFixed(2),
      weight: 0.14
    });

    // 添加内容因素
    const urlScore = tab.url ? Math.min(tab.url.length / 100, 1) : 0;
    const titleScore = tab.title ? Math.min(tab.title.length / 50, 1) : 0;
    const domainScore = tab.url ? extractDomain(tab.url).length / 20 : 0;

    result.factors.push({
      name: 'URL长度',
      value: tab.url ? tab.url.length : 0,
      score: urlScore.toFixed(2),
      weight: 0.12
    });

    result.factors.push({
      name: '标题长度',
      value: tab.title ? tab.title.length : 0,
      score: titleScore.toFixed(2),
      weight: 0.12
    });

    result.factors.push({
      name: '域名长度',
      value: tab.url ? extractDomain(tab.url).length : 0,
      score: domainScore.toFixed(2),
      weight: 0.06
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
/**
 * 格式化访问次数
 * @param {number} tabId - 标签ID
 * @returns {string} 格式化的访问次数
 */
function formatVisitCount(tabId) {
  const metadata = getTabMetadata(tabId);
  return metadata ? `${metadata.accessCount || 0}次` : '0次';
}

/**
 * 格式化最后访问时间
 * @param {number} tabId - 标签ID
 * @returns {string} 格式化的最后访问时间
 */
function formatLastVisit(tabId) {
  const metadata = getTabMetadata(tabId);
  return metadata && metadata.lastAccess ? formatTimeDifference(metadata.lastAccess) : '从未';
}

/**
 * 格式化停留时间
 * @param {number} tabId - 标签ID
 * @returns {string} 格式化的停留时间
 */
function formatStayTime(tabId) {
  const metadata = getTabMetadata(tabId);
  return metadata ? formatTime(metadata.totalTime || 0) : '0分钟';
}

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
    // 获取行为分数详情
    const behaviorResult = calculateGroupBehaviorScore(tabs);
    const behaviorComponents = behaviorResult.components;

    // 添加行为因素
    result.factors.push({
      name: '访问频率',
      value: '组内平均',
      score: behaviorComponents.accessScore.toFixed(2),
      weight: 0.28
    });

    result.factors.push({
      name: '最近访问',
      value: tabs.length > 0 && behaviorComponents.recencyScore > 0 ?
             formatTimeDifference(Date.now() - (1 - behaviorComponents.recencyScore) * 7 * 24 * 60 * 60 * 1000) : '从未',
      score: behaviorComponents.recencyScore.toFixed(2),
      weight: 0.28
    });

    result.factors.push({
      name: '停留时间',
      value: '组内平均',
      score: behaviorComponents.timeScore.toFixed(2),
      weight: 0.14
    });

    // 添加标签数量因素
    const size = tabs.length;
    const sizeScore = Math.min(size / 10, 1);

    result.factors.push({
      name: '标签数量',
      value: size,
      score: sizeScore.toFixed(2),
      weight: 0.3
    });
  }

  return result;
}
