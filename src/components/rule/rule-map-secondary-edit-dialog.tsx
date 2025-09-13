import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  IconCheck, 
  IconX,
  IconTrash, 
  IconArrowUp, 
  IconArrowDown,
  IconPlus
} from '@tabler/icons-react';
import type { Rule, RuleMapInfo, ListConfig, RULE_MAP_TYPE } from '@/lib/rules';
import { nanoid } from 'nanoid';
import { saveGlobalMapLists } from '@/lib/rules';

export interface RuleMapSecondaryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo>;
  onOverwriteRule: (updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo>) => void;
}

/**
 * 列表映射规则二次编辑对话框
 * 采用左右分栏设计，与列表编辑对话框保持一致
 */
export const RuleMapSecondaryEditDialog: React.FC<RuleMapSecondaryEditDialogProps> = ({
  open,
  onOpenChange,
  rule,
  onOverwriteRule
}) => {
  // 编辑状态
  const [includeExt, setIncludeExt] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [previewItems, setPreviewItems] = useState<string[]>([]);
  const [isRenamingForTemplate, setIsRenamingForTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // 初始化数据
  useEffect(() => {
    if (open && rule) {
      setIncludeExt(rule.info.includeExt);
      const activeList = rule.info.lists[rule.info.activeListIndex];
      if (activeList) {
        setTextContent(activeList.targetNames.join('\n'));
        setPreviewItems([...activeList.targetNames]);
      }
    }
  }, [open, rule]);

  // 文本内容变化时更新预览
  useEffect(() => {
    const lines = textContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setPreviewItems(lines);
  }, [textContent]);

  const activeList = rule?.info.lists[rule.info.activeListIndex] || { name: '', targetNames: [] };


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
   * 创建更新后的规则信息
   */
  const createUpdatedRuleInfo = (): RuleMapInfo => {
    const updatedLists = [...rule.info.lists];
    updatedLists[rule.info.activeListIndex] = {
      ...activeList,
      targetNames: previewItems
    };

    return {
      lists: updatedLists,
      activeListIndex: rule.info.activeListIndex,
      includeExt
    };
  };

  /**
   * 保存列表配置到全局存储
   */
  const saveListsToGlobal = async (updatedRuleInfo: RuleMapInfo) => {
    try {
      await saveGlobalMapLists(updatedRuleInfo.lists);
    } catch (error) {
      console.error('保存全局列表配置失败:', error);
    }
  };

  /**
   * 覆盖现有规则
   */
  const handleOverwrite = async () => {
    try {
      const updatedRuleInfo = createUpdatedRuleInfo();
      const updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo> = {
        ...rule,
        info: updatedRuleInfo
      };

      console.log('覆盖现有规则:', {
        originalRule: rule,
        updatedRule,
        updatedLists: updatedRuleInfo.lists
      });

      // 同时更新全局列表配置
      await saveListsToGlobal(updatedRuleInfo.lists);
      
      console.log('全局列表配置已更新');

      onOverwriteRule(updatedRule);
      onOpenChange(false);
    } catch (error) {
      console.error('覆盖规则失败:', error);
    }
  };

  /**
   * 开始重命名流程，准备另存为新规则模板
   */
  const handleStartSaveAsNewTemplate = () => {
    setNewTemplateName(`${activeList.name} - 副本`);
    setIsRenamingForTemplate(true);
  };

  /**
   * 确认另存为新规则模板
   */
  const handleConfirmSaveAsNewTemplate = async () => {
    if (!newTemplateName.trim()) return;
    
    try {
      // 创建新的列表配置，包含重命名后的列表
      const newListConfig: ListConfig = {
        name: newTemplateName.trim(),
        targetNames: previewItems
      };
      
      // 获取当前的全局列表配置
      const { getGlobalMapLists } = await import('@/lib/rules');
      const currentGlobalLists = await getGlobalMapLists();
      
      // 将新列表添加到现有全局列表中
      const updatedLists = [...currentGlobalLists, newListConfig];
      
      console.log('保存新模板:', {
        newListConfig,
        currentGlobalLists,
        updatedLists
      });
      
      // 更新全局列表配置
      await saveGlobalMapLists(updatedLists);
      
      console.log('全局列表配置已更新');
      
      setIsRenamingForTemplate(false);
      setNewTemplateName('');
      onOpenChange(false);
    } catch (error) {
      console.error('保存新模板失败:', error);
    }
  };

  /**
   * 取消重命名
   */
  const handleCancelRename = () => {
    setIsRenamingForTemplate(false);
    setNewTemplateName('');
  };

  /**
   * 取消编辑
   */
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑列表映射规则</DialogTitle>
        </DialogHeader>
        
        {/* 顶部选项 */}
        <div className="flex items-center justify-between mb-4">
          {/* 包含扩展名选项 */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeExt"
              checked={includeExt}
              onChange={(e) => setIncludeExt(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="includeExt" className="text-sm font-medium">
              包含扩展名
            </label>
          </div>

          {/* 显示当前编辑的列表名称 */}
          <div className="text-sm text-muted-foreground">
            正在编辑: <span className="font-medium">{activeList.name}</span>
          </div>
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
            <div className="mt-2 text-sm text-muted-foreground">
              共 {previewItems.length} 个文件名
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
                    {previewItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 hover:bg-accent/50 group"
                      >
                        <span className="flex-1 text-sm font-mono">
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
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 重命名界面 */}
        {isRenamingForTemplate && (
          <div className="border-t pt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">新模板名称</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="请输入新模板的名称"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmSaveAsNewTemplate();
                  } else if (e.key === 'Escape') {
                    handleCancelRename();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelRename}>
                <IconX className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button 
                onClick={handleConfirmSaveAsNewTemplate}
                disabled={!newTemplateName.trim()}
              >
                <IconCheck className="h-4 w-4 mr-2" />
                确认保存
              </Button>
            </div>
          </div>
        )}

        {/* 底部按钮 */}
        {!isRenamingForTemplate && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              编辑完成后可以覆盖现有规则或另存为新规则模板
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <IconX className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button variant="outline" onClick={handleOverwrite}>
                覆盖现有规则
              </Button>
              <Button onClick={handleStartSaveAsNewTemplate}>
                <IconPlus className="h-4 w-4 mr-2" />
                另存为新规则模板
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
