import { useCallback, useEffect, useState } from 'react';

/**
 * 可调整大小的分隔线属性
 */
export interface ResizableDividerProps {
  /**
   * 调整方向，垂直分隔线用于调整列宽
   */
  direction?: 'vertical' | 'horizontal';
  
  /**
   * 拖动开始时的回调函数
   */
  onResizeStart?: () => void;
  
  /**
   * 拖动时的回调函数
   * @param delta - 拖动距离
   */
  onResize?: (delta: number) => void;
  
  /**
   * 拖动完成时的回调函数
   */
  onResizeEnd?: () => void;
  
  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 可调整大小的分隔线组件
 * 用于在表格或面板中插入可拖动调整大小的分隔线
 */
export function ResizableDivider({
  direction = 'vertical',
  onResizeStart,
  onResize,
  onResizeEnd,
  className = '',
}: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  // 处理拖动开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    
    if (onResizeStart) {
      onResizeStart();
    }
  }, [onResizeStart]);
  
  // 处理拖动过程
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    const delta = direction === 'vertical' 
      ? e.clientX - startPos.x 
      : e.clientY - startPos.y;
    
    if (delta !== 0 && onResize) {
      onResize(delta);
      // 更新起始位置，以便下次计算增量
      setStartPos({ x: e.clientX, y: e.clientY });
    }
  }, [direction, isDragging, onResize, startPos]);
  
  // 处理拖动结束
  const handleMouseUp = useCallback(() => {
    if (isDragging && onResizeEnd) {
      onResizeEnd();
    }
    setIsDragging(false);
  }, [isDragging, onResizeEnd]);
  
  // 添加全局事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  return (
    <div
      onMouseDown={handleMouseDown}
      className={`${
        direction === 'vertical' 
          ? 'w-1.5 cursor-col-resize hover:bg-blue-400 active:bg-blue-500' 
          : 'h-1.5 cursor-row-resize hover:bg-blue-400 active:bg-blue-500'
      } bg-transparent hover:opacity-80 z-10 ${
        isDragging ? 'bg-blue-500' : ''
      } ${className}`}
    />
  );
} 