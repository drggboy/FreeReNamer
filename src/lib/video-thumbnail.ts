/**
 * 视频缩略图生成工具
 * 支持Web端和Tauri端的视频缩略图生成
 */

/**
 * Web端：使用HTML5 Video API和Canvas生成视频缩略图
 * @param file - 文件对象（FileSystemFileHandle或Blob）
 * @param options - 缩略图选项
 * @returns Promise<string> - 返回base64格式的缩略图数据URL
 */
export async function generateVideoThumbnailWeb(
  file: FileSystemFileHandle | Blob,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    seekTime?: number; // 截取时间点（秒）
  } = {}
): Promise<string> {
  const { width = 160, height = 120, quality = 0.8, seekTime = 1 } = options;

  // 获取文件对象
  let fileObj: File;
  if (file instanceof Blob) {
    fileObj = file as File;
  } else {
    fileObj = await (file as FileSystemFileHandle).getFile();
  }

  return new Promise((resolve, reject) => {
    // 创建video元素
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    // 创建canvas用于截取帧
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('无法创建Canvas上下文'));
      return;
    }

    // 设置canvas尺寸
    canvas.width = width;
    canvas.height = height;

    // 视频加载完成事件
    const onLoadedMetadata = () => {
      // 设置seek时间，但不超过视频总长度
      const targetTime = Math.min(seekTime, video.duration || 1);
      video.currentTime = targetTime;
    };

    // 视频seek完成事件
    const onSeeked = () => {
      try {
        // 计算保持宽高比的缩放尺寸
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const canvasAspectRatio = width / height;
        
        let drawWidth = width;
        let drawHeight = height;
        let offsetX = 0;
        let offsetY = 0;

        if (videoAspectRatio > canvasAspectRatio) {
          // 视频更宽，以高度为准
          drawHeight = height;
          drawWidth = height * videoAspectRatio;
          offsetX = (width - drawWidth) / 2;
        } else {
          // 视频更高，以宽度为准
          drawWidth = width;
          drawHeight = width / videoAspectRatio;
          offsetY = (height - drawHeight) / 2;
        }

        // 填充背景
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        // 绘制视频帧
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

        // 转换为base64
        const dataURL = canvas.toDataURL('image/jpeg', quality);
        
        // 清理资源
        cleanup();
        resolve(dataURL);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    // 错误处理
    const onError = (error: any) => {
      cleanup();
      reject(new Error(`视频加载失败: ${error.message || error}`));
    };

    // 清理资源
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      
      // 释放blob URL
      if (video.src && video.src.startsWith('blob:')) {
        URL.revokeObjectURL(video.src);
      }
      
      video.src = '';
      video.load();
    };

    // 设置事件监听器
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // 创建blob URL并加载视频
    try {
      const blobURL = URL.createObjectURL(fileObj);
      video.src = blobURL;
      video.load();
    } catch (error) {
      cleanup();
      reject(error);
    }

    // 设置超时
    setTimeout(() => {
      cleanup();
      reject(new Error('视频缩略图生成超时'));
    }, 10000); // 10秒超时
  });
}

/**
 * Tauri端：通过Rust后端生成视频缩略图
 * @param filePath - 文件路径
 * @param options - 缩略图选项
 * @returns Promise<string> - 返回base64格式的缩略图数据URL
 */
export async function generateVideoThumbnailTauri(
  filePath: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    seekTime?: number; // 截取时间点（秒）
  } = {}
): Promise<string> {
  const { width = 160, height = 120, seekTime = 1 } = options;

  try {
    const { invoke } = await import('@tauri-apps/api');
    
    // 调用Rust后端生成缩略图
    const thumbnailBase64 = await invoke<string>('generate_video_thumbnail', {
      path: filePath,
      width,
      height,
      seekTime
    });

    return `data:image/jpeg;base64,${thumbnailBase64}`;
  } catch (error) {
    console.error('Tauri视频缩略图生成失败:', error);
    throw new Error(`无法生成视频缩略图: ${error}`);
  }
}

/**
 * 统一的视频缩略图生成接口
 * 根据环境自动选择Web或Tauri实现
 */
export async function generateVideoThumbnail(
  file: string | FileSystemFileHandle | Blob,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    seekTime?: number;
  } = {}
): Promise<string> {
  // 检查是否为Tauri环境
  // @ts-ignore
  if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
    if (typeof file === 'string') {
      return generateVideoThumbnailTauri(file, options);
    } else {
      throw new Error('Tauri环境需要文件路径字符串');
    }
  } else {
    // Web环境
    if (typeof file === 'string') {
      throw new Error('Web环境需要FileSystemFileHandle或Blob对象');
    }
    return generateVideoThumbnailWeb(file as FileSystemFileHandle | Blob, options);
  }
}
