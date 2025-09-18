export interface FileInfo {
  name: string;
  ext: string;
  fullName: string;
  timestamp?: number; // 文件时间戳
  timeString?: string; // 格式化后的时间字符串
  isImage?: boolean; // 是否是图片文件
  isVideo?: boolean; // 是否是视频文件
}
