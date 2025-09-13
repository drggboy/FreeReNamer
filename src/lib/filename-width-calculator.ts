/**
 * 文件名宽度计算工具
 * 用于根据文件列表中最长的文件名计算合适的列宽
 */

/**
 * 计算文本宽度的工具函数
 * @param text 要计算宽度的文本
 * @param fontSize 字体大小（像素）
 * @param fontFamily 字体族
 * @returns 文本宽度（像素）
 */
function getTextWidth(text: string, fontSize: number = 14, fontFamily: string = 'system-ui, -apple-system, sans-serif'): number {
  // 创建一个临时的canvas元素来测量文本宽度
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    // 如果无法获取context，使用估算方法
    return text.length * fontSize * 0.6; // 粗略估算
  }
  
  context.font = `${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(text);
  
  return metrics.width;
}

/**
 * 获取文件列表中最长的文件名
 * @param files 文件列表
 * @returns 最长的文件名
 */
export function getLongestFilename(files: Array<string | { name: string }>): string {
  if (files.length === 0) return '';
  
  let longestName = '';
  let maxLength = 0;
  
  for (const file of files) {
    const filename = typeof file === 'string' ? file : file.name;
    if (filename.length > maxLength) {
      maxLength = filename.length;
      longestName = filename;
    }
  }
  
  return longestName;
}

/**
 * 计算文件名列的理想宽度百分比
 * @param files 文件列表
 * @param containerWidth 容器宽度（像素）
 * @param options 配置选项
 * @returns 理想的文件名列宽度百分比
 */
export interface FilenameWidthOptions {
  /** 最小宽度百分比 */
  minWidthPercent?: number;
  /** 最大宽度百分比 */
  maxWidthPercent?: number;
  /** 额外的padding（像素） */
  extraPadding?: number;
  /** 字体大小（像素） */
  fontSize?: number;
  /** 字体族 */
  fontFamily?: string;
  /** 超长文件名的截断长度（字符数） */
  maxFilenameLength?: number;
}

export function calculateFilenameWidth(
  files: Array<string | { name: string }>,
  containerWidth: number,
  options: FilenameWidthOptions = {}
): number {
  const {
    minWidthPercent = 15,
    maxWidthPercent = 60,
    extraPadding = 10, // 额外的padding空间
    fontSize = 14,
    fontFamily = 'system-ui, -apple-system, sans-serif',
    maxFilenameLength = 50 // 超过50个字符认为是超长文件名
  } = options;
  
  // 如果没有文件，返回默认宽度
  if (files.length === 0) {
    return minWidthPercent;
  }
  
  // 获取最长的文件名
  let longestFilename = getLongestFilename(files);
  
  // 如果文件名过长，进行截断处理
  if (longestFilename.length > maxFilenameLength) {
    longestFilename = longestFilename.substring(0, maxFilenameLength) + '...';
    console.log(`检测到超长文件名，截断为: ${longestFilename}`);
  }
  
  // 计算文本宽度
  const textWidth = getTextWidth(longestFilename, fontSize, fontFamily);
  
  // 加上额外的padding
  const totalRequiredWidth = textWidth + extraPadding;
  
  // 转换为百分比
  const requiredPercent = (totalRequiredWidth / containerWidth) * 100;
  
  // 对于所有文件名都进一步紧缩宽度，让它更贴近实际需要
  let adjustedPercent = requiredPercent * 0.7; // 统一减少30%，更贴近实际需要
  
  // 应用最小和最大宽度限制
  const finalPercent = Math.max(minWidthPercent, Math.min(maxWidthPercent, adjustedPercent));
  
  console.log(`文件名宽度计算:`, {
    longestFilename,
    textWidth: Math.round(textWidth),
    totalRequiredWidth: Math.round(totalRequiredWidth),
    containerWidth,
    requiredPercent: Math.round(requiredPercent * 100) / 100,
    adjustedPercent: Math.round(adjustedPercent * 100) / 100,
    finalPercent: Math.round(finalPercent * 100) / 100
  });
  
  return Math.round(finalPercent * 100) / 100; // 保留两位小数
}

/**
 * 检查是否需要调整文件名列宽
 * @param currentWidthPercent 当前宽度百分比
 * @param idealWidthPercent 理想宽度百分比
 * @param threshold 调整阈值百分比
 * @returns 是否需要调整
 */
export function shouldAdjustFilenameWidth(
  currentWidthPercent: number,
  idealWidthPercent: number,
  threshold: number = 5 // 5%的差异才触发调整
): boolean {
  return Math.abs(currentWidthPercent - idealWidthPercent) > threshold;
}

/**
 * 批量计算多个文件列表的理想宽度
 * @param fileLists 多个文件列表
 * @param containerWidth 容器宽度
 * @param options 配置选项
 * @returns 理想宽度百分比
 */
export function calculateBatchFilenameWidth(
  fileLists: Array<Array<string | { name: string }>>,
  containerWidth: number,
  options: FilenameWidthOptions = {}
): number {
  if (fileLists.length === 0) return options.minWidthPercent || 15;
  
  // 合并所有文件列表
  const allFiles = fileLists.flat();
  
  return calculateFilenameWidth(allFiles, containerWidth, options);
}
