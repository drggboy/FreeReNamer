import { useAtomValue } from 'jotai';
import { getProfileCurrentFolderAtom, currentFolderAtom } from '@/lib/atoms';
import { IconFolder } from '@tabler/icons-react';

interface CurrentFolderDisplayProps {
  /**
   * 配置ID，用于获取该配置的当前文件夹状态
   * 如果为null，则使用全局的currentFolderAtom（Web环境）
   */
  profileId?: string | null;
  /**
   * 自定义样式类名
   */
  className?: string;
  /**
   * 点击文件夹图标时的回调函数
   */
  onFolderClick?: () => void;
}

/**
 * 当前文件夹显示组件
 * 用于显示指定配置当前选中的文件夹路径
 */
export function CurrentFolderDisplay({ 
  profileId, 
  className = '',
  onFolderClick
}: CurrentFolderDisplayProps) {
  // 根据profileId决定使用哪个atom
  const currentFolder = useAtomValue(
    profileId ? getProfileCurrentFolderAtom(profileId) : currentFolderAtom
  );

  // 如果没有选中文件夹，显示提示信息
  if (!currentFolder) {
    return (
      <div className={`inline-flex items-center px-2 py-1 text-xs text-muted-foreground bg-gray-100 border border-gray-200 rounded ${className}`}>
        <IconFolder className="mr-1 size-3" />
        未选择文件夹
      </div>
    );
  }

  // 处理文件夹路径显示
  const displayPath = typeof currentFolder === 'string' 
    ? currentFolder 
    : currentFolder.name; // Web环境下的DirectoryHandle

  // 截取过长的路径，只显示最后几级目录
  const formatPath = (path: string) => {
    if (path.length <= 50) return path;
    
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) return path;
    
    // 显示 ".../{倒数第二级}/{最后一级}"
    return `.../${parts.slice(-2).join('/')}`;
  };

  return (
    <div className={`inline-flex items-center px-2 py-1 text-xs bg-blue-50 border border-blue-200 rounded max-w-xs ${className}`}>
      <button
        onClick={onFolderClick}
        className="mr-1 p-0 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
        title="点击打开文件夹"
        disabled={!onFolderClick}
      >
        <IconFolder className="size-3 text-blue-600 hover:text-blue-700" />
      </button>
      <span className="truncate text-blue-800" title={displayPath}>
        {formatPath(displayPath)}
      </span>
    </div>
  );
}
