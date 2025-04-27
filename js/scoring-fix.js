/**
 * 修复分数计算显示问题
 *
 * 这个文件包含修复分数计算显示的函数
 */

/**
 * 修复标签页分数计算显示
 * @param {string} displayText - 原始显示文本
 * @returns {string} 修复后的显示文本
 */
export function fixTabScoreDisplay(displayText) {
  console.log('[DEBUG] 修复前的显示文本:', displayText);

  // 使用正则表达式提取所有因素的分数
  const accessFreqMatch = displayText.match(/访问频率\(([0-9.]+)\)/);
  const recentVisitMatch = displayText.match(/最近访问\(([0-9.]+)\)/);
  const stayTimeMatch = displayText.match(/停留时间\(([0-9.]+)\)/);
  const urlLengthMatch = displayText.match(/URL长度\(([0-9.]+)\)/);
  const titleLengthMatch = displayText.match(/标题长度\(([0-9.]+)\)/);
  const domainLengthMatch = displayText.match(/域名长度\(([0-9.]+)\)/);

  // 替换所有的因素分数，确保显示正确的值
  let fixedText = displayText;

  // 访问频率
  if (accessFreqMatch) {
    const score = parseFloat(accessFreqMatch[1]);
    fixedText = fixedText.replace(/访问频率\([0-9.]+\)/g, `访问频率(${score.toFixed(2)})`);
  }

  // 最近访问
  if (recentVisitMatch) {
    const score = parseFloat(recentVisitMatch[1]);
    fixedText = fixedText.replace(/最近访问\([0-9.]+\)/g, `最近访问(${score.toFixed(2)})`);
  }

  // 停留时间
  if (stayTimeMatch) {
    const score = parseFloat(stayTimeMatch[1]);
    fixedText = fixedText.replace(/停留时间\([0-9.]+\)/g, `停留时间(${score.toFixed(2)})`);
  }

  // URL长度
  if (urlLengthMatch) {
    const score = parseFloat(urlLengthMatch[1]);
    fixedText = fixedText.replace(/URL长度\([0-9.]+\)/g, `URL长度(${score.toFixed(2)})`);
  }

  // 标题长度
  if (titleLengthMatch) {
    const score = parseFloat(titleLengthMatch[1]);
    fixedText = fixedText.replace(/标题长度\([0-9.]+\)/g, `标题长度(${score.toFixed(2)})`);
  }

  // 域名长度
  if (domainLengthMatch) {
    const score = parseFloat(domainLengthMatch[1]);
    fixedText = fixedText.replace(/域名长度\([0-9.]+\)/g, `域名长度(${score.toFixed(2)})`);
  }

  console.log('[DEBUG] 修复后的显示文本:', fixedText);
  return fixedText;
}

/**
 * 修复标签组分数计算显示
 * @param {Object} groupScoringDetails - 标签组评分详情
 * @returns {Object} 修复后的标签组评分详情
 */
export function fixGroupScoringDetails(groupScoringDetails) {
  if (!groupScoringDetails || !groupScoringDetails.factors) {
    return groupScoringDetails;
  }

  // 创建一个新的对象，避免修改原始对象
  const fixedDetails = {
    ...groupScoringDetails,
    factors: [...groupScoringDetails.factors]
  };

  // 修复每个因素的分数
  for (let i = 0; i < fixedDetails.factors.length; i++) {
    const factor = fixedDetails.factors[i];

    // 确保所有因素的分数都是正确的
    switch (factor.name) {
      case '访问频率':
        // 访问频率可能为0，这是正常的
        // 如果扩展刚安装，还没有收集到足够的数据
        if (factor.score === "0.00") {
          factor.value = factor.value || "组内平均";
        }
        break;
      case '最近访问':
        // 最近访问可能为0，这是正常的
        // 如果扩展刚安装，还没有收集到足够的数据
        if (factor.score === "0.00") {
          factor.value = factor.value || "从未";
        }
        break;
      case '停留时间':
        // 停留时间可能为0，这是正常的
        // 如果扩展刚安装，还没有收集到足够的数据
        if (factor.score === "0.00") {
          factor.value = factor.value || "组内平均";
        }
        break;
      case '标签数量':
        // 标签数量应该根据实际值计算
        if (typeof factor.value === 'number') {
          factor.score = Math.min(factor.value / 10, 1).toFixed(2);
        }
        break;
    }
  }

  return fixedDetails;
}

/**
 * 修复标签页分数计算显示
 * @param {Object} tabScoringDetails - 标签页评分详情
 * @returns {Object} 修复后的标签页评分详情
 */
export function fixTabScoringDetails(tabScoringDetails) {
  if (!tabScoringDetails || !tabScoringDetails.factors) {
    return tabScoringDetails;
  }

  // 创建一个新的对象，避免修改原始对象
  const fixedDetails = {
    ...tabScoringDetails,
    factors: [...tabScoringDetails.factors]
  };

  // 修复每个因素的分数
  for (let i = 0; i < fixedDetails.factors.length; i++) {
    const factor = fixedDetails.factors[i];

    // 确保所有因素的分数都是正确的
    switch (factor.name) {
      case '访问频率':
        // 访问频率可能为0，这是正常的
        // 如果扩展刚安装，还没有收集到足够的数据
        if (factor.score === "0.00") {
          factor.value = factor.value || "0次";
        }
        break;
      case '最近访问':
        // 最近访问可能为0，这是正常的
        // 如果扩展刚安装，还没有收集到足够的数据
        if (factor.score === "0.00") {
          factor.value = factor.value || "从未";
        }
        break;
      case '停留时间':
        // 停留时间可能为0，这是正常的
        // 如果扩展刚安装，还没有收集到足够的数据
        if (factor.score === "0.00") {
          factor.value = factor.value || "0分钟";
        }
        break;
      case 'URL长度':
        // URL长度应该根据实际值计算
        if (typeof factor.value === 'number') {
          factor.score = Math.min(factor.value / 100, 1).toFixed(2);
        }
        break;
      case '标题长度':
        // 标题长度应该根据实际值计算
        if (typeof factor.value === 'number') {
          factor.score = Math.min(factor.value / 50, 1).toFixed(2);
        }
        break;
      case '域名长度':
        // 域名长度应该根据实际值计算
        if (typeof factor.value === 'number') {
          factor.score = (factor.value / 20).toFixed(2);
        }
        break;
    }
  }

  return fixedDetails;
}
