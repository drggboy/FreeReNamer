/**
 * 文件名宽度计算工具
 * 用于根据文件列表中最长的文件名计算合适的列宽
 */

import type { ColumnWidths } from './atoms';

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

/**
 * 获取时间字符串的最长值
 * @param files 文件信息列表
 * @returns 最长的时间字符串
 */
function getLongestTimeString(files: Array<{ timeString?: string }>): string {
  let longestTime = '';
  let maxLength = 0;
  
  for (const file of files) {
    const timeStr = file.timeString || '';
    if (timeStr.length > maxLength) {
      maxLength = timeStr.length;
      longestTime = timeStr;
    }
  }
  
  return longestTime || '2024-01-01 12:00:00'; // 默认时间格式
}

/**
 * 计算智能列宽配置
 * @param files 文件列表（文件名）
 * @param fileInfos 文件信息列表（包含时间等）
 * @param containerWidth 容器宽度
 * @param options 配置选项
 * @returns 智能计算的列宽配置
 */
export interface SmartColumnWidthOptions {
  /** 字体大小（像素） */
  fontSize?: number;
  /** 字体族 */
  fontFamily?: string;
  /** 额外的padding（像素） */
  extraPadding?: number;
  /** 固定列宽（rem） */
  fixedColumnWidths?: {
    checkbox?: number;
    index?: number;
    thumbnail?: number;
  };
  /** 最小宽度限制（百分比） */
  minWidthPercents?: {
    filename?: number;
    time?: number;
    manual?: number;
  };
  /** 最大宽度限制（百分比） */
  maxWidthPercents?: {
    filename?: number;
    time?: number;
    manual?: number;
  };
}

export function calculateSmartColumnWidths(
  files: Array<string | { name: string }>,
  fileInfos: Array<{ timeString?: string }> = [],
  containerWidth: number,
  options: SmartColumnWidthOptions = {}
): ColumnWidths {
  console.log('🧮 calculateSmartColumnWidths 被调用');
  console.log('传入参数:', { 
    filesCount: files.length, 
    fileInfosCount: fileInfos.length, 
    containerWidth,
    options 
  });
  
  const {
    fontSize = 14,
    fontFamily = 'system-ui, -apple-system, sans-serif',
    extraPadding = 32, // 增加padding以确保有足够空间
    fixedColumnWidths = {
      checkbox: 3,
      index: 5,
      thumbnail: 15
    },
    minWidthPercents = {
      filename: 20,
      time: 12,
      manual: 15
    },
    maxWidthPercents = {
      filename: 50,
      time: 25,
      manual: 30
    }
  } = options;

  // 如果没有文件，返回默认配置
  if (files.length === 0) {
    return {
      checkbox: fixedColumnWidths.checkbox || 3,
      index: fixedColumnWidths.index || 5,
      filename: minWidthPercents.filename || 20,
      time: minWidthPercents.time || 12,
      thumbnail: fixedColumnWidths.thumbnail || 15,
      preview: 1,
      manual: minWidthPercents.manual || 15
    };
  }

  // 计算文件名列宽度
  const longestFilename = getLongestFilename(files);
  const filenameTextWidth = getTextWidth(longestFilename, fontSize, fontFamily);
  const filenameRequiredPercent = ((filenameTextWidth + extraPadding) / containerWidth) * 100;
  const filenameWidth = Math.max(
    minWidthPercents.filename || 20,
    Math.min(maxWidthPercents.filename || 50, filenameRequiredPercent)
  );

  // 计算时间列宽度
  // 如果没有提供文件信息，使用典型的时间格式估算
  const longestTimeString = fileInfos.length > 0 
    ? getLongestTimeString(fileInfos)
    : '2024-12-31 23:59:59'; // 使用最长可能的时间格式
  const timeTextWidth = getTextWidth(longestTimeString, fontSize, fontFamily);
  const timeRequiredPercent = ((timeTextWidth + extraPadding) / containerWidth) * 100;
  const timeWidth = Math.max(
    minWidthPercents.time || 12,
    Math.min(maxWidthPercents.time || 25, timeRequiredPercent)
  );

  // 计算手动修改列宽度（通常显示文件名或预览名，所以基于文件名计算但稍微小一些）
  const manualRequiredPercent = filenameRequiredPercent * 0.8; // 手动列通常比文件名稍短
  const manualWidth = Math.max(
    minWidthPercents.manual || 15,
    Math.min(maxWidthPercents.manual || 30, manualRequiredPercent)
  );

  console.log('智能列宽计算结果:', {
    longestFilename,
    longestTimeString,
    filenameWidth: Math.round(filenameWidth * 100) / 100,
    timeWidth: Math.round(timeWidth * 100) / 100,
    manualWidth: Math.round(manualWidth * 100) / 100,
    containerWidth
  });

  return {
    checkbox: fixedColumnWidths.checkbox || 3,
    index: fixedColumnWidths.index || 5,
    filename: Math.round(filenameWidth * 100) / 100,
    time: Math.round(timeWidth * 100) / 100,
    thumbnail: fixedColumnWidths.thumbnail || 15,
    preview: 1, // 自适应
    manual: Math.round(manualWidth * 100) / 100
  };
}