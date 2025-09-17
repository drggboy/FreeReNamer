import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  IconTrash, 
  IconArrowUp, 
  IconArrowDown, 
  IconCheck, 
  IconX,
  IconAlertCircle
} from '@tabler/icons-react';
import type { ListConfig } from '@/lib/rules';
import { toast } from 'sonner';

export interface ListEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listConfig: ListConfig;
  onSave: (updatedConfig: ListConfig) => void;
}

/**
 * 列表编辑对话框组件
 * 提供左右分栏的编辑界面：左侧文本编辑，右侧效果预览
 */
export const ListEditDialog: React.FC<ListEditDialogProps> = ({
  open,
  onOpenChange,
  listConfig,
  onSave
}) => {
  const [listName, setListName] = useState(listConfig.name);
  const [textContent, setTextContent] = useState('');
  const [previewItems, setPreviewItems] = useState<string[]>([]);
  const [duplicateItems, setDuplicateItems] = useState<string[]>([]);

  // 初始化数据
  useEffect(() => {
    if (open) {
      setListName(listConfig.name);
      setTextContent(listConfig.targetNames.join('\n'));
      setPreviewItems([...listConfig.targetNames]);
    }
  }, [open, listConfig]);

  // 文本内容变化时更新预览和检查重复项
  useEffect(() => {
    const lines = textContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setPreviewItems(lines);
    
    // 检查重复项
    const duplicates = findDuplicateItems(lines);
    setDuplicateItems(duplicates);
  }, [textContent]);

  /**
   * 检查重复项
   */
  const findDuplicateItems = (items: string[]): string[] => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    
    for (const item of items) {
      if (seen.has(item)) {
        duplicates.add(item);
      } else {
        seen.add(item);
      }
    }
    
    return Array.from(duplicates);
  };

  /**
   * 校验是否存在重复项
   */
  const validateNoDuplicates = (): boolean => {
    if (duplicateItems.length > 0) {
      toast.error(`存在重复的文件名: ${duplicateItems.join(', ')}`);
      return false;
    }
    return true;
  };

  /**
   * 从预览区域删除项目
   */
  const handleDeletePreviewItem = (index: number) => {
    const newItems = previewItems.filter((_, i) => i !== index);
    setPreviewItems(newItems);
    setTextContent(newItems.join('\n'));
  };

  /**
   * 在预览区域上移项目
   */
  const handleMoveUpPreviewItem = (index: number) => {
    if (index === 0) return;
    const newItems = [...previewItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setPreviewItems(newItems);
    setTextContent(newItems.join('\n'));
  };

  /**
   * 在预览区域下移项目
   */
  const handleMoveDownPreviewItem = (index: number) => {
    if (index === previewItems.length - 1) return;
    const newItems = [...previewItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setPreviewItems(newItems);
    setTextContent(newItems.join('\n'));
  };

  /**
   * 保存修改
   */
  const handleSave = () => {
    // 先校验重复项
    if (!validateNoDuplicates()) {
      return;
    }
    
    const updatedConfig: ListConfig = {
      name: listName.trim() || listConfig.name,
      targetNames: previewItems
    };
    onSave(updatedConfig);
    onOpenChange(false);
  };

  /**
   * 取消修改
   */
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑列表</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">列表名称</label>
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="请输入列表名称"
          />
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* 左侧：文本编辑区域（带行号） */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium mb-2">
              文本编辑（每行一个文件名）
            </label>
            <div className="flex-1 border rounded-md overflow-hidden flex bg-background">
              {/* 行号区域 */}
              <div className="bg-muted/30 border-r px-3 py-2 text-right text-sm font-mono text-muted-foreground select-none min-w-[3rem] shrink-0">
                {textContent.split('\n').map((_, index) => (
                  <div key={index} className="leading-6 h-6">
                    {index + 1}
                  </div>
                ))}
              </div>
              {/* 文本编辑区域 */}
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="请输入文件名，每行一个"
                className="flex-1 resize-none font-mono border-none focus-visible:ring-0 leading-6 bg-transparent"
                style={{ 
                  lineHeight: '1.5rem',
                  padding: '0.5rem'
                }}
              />
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <div className="text-sm text-muted-foreground">
                共 {previewItems.length} 个文件名
              </div>
              {duplicateItems.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <IconAlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    存在重复文件名: {duplicateItems.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：效果预览区域 */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium mb-2">
              效果预览
            </label>
            <div className="flex-1 border rounded-md overflow-hidden">
              <div className="h-full overflow-y-auto">
                {previewItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    暂无内容
                  </div>
                ) : (
                  <div className="divide-y">
                    {previewItems.map((item, index) => {
                      const isDuplicate = duplicateItems.includes(item);
                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 p-2 hover:bg-accent/50 group ${
                            isDuplicate ? 'bg-red-50 border-l-2 border-red-500' : ''
                          }`}
                        >
                          <span className={`flex-1 text-sm font-mono ${
                            isDuplicate ? 'text-red-600 font-medium' : ''
                          }`}>
                            {isDuplicate && <IconAlertCircle className="inline h-3 w-3 mr-1" />}
                            {index + 1}. {item}
                          </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveUpPreviewItem(index)}
                            disabled={index === 0}
                            className="h-6 w-6 p-0"
                            title="上移"
                          >
                            <IconArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveDownPreviewItem(index)}
                            disabled={index === previewItems.length - 1}
                            className="h-6 w-6 p-0"
                            title="下移"
                          >
                            <IconArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePreviewItem(index)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            title="删除"
                          >
                            <IconTrash className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            <IconX className="h-4 w-4 mr-2" />
            取消
          </Button>
          <Button 
            onClick={handleSave}
            disabled={duplicateItems.length > 0}
          >
            <IconCheck className="h-4 w-4 mr-2" />
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
