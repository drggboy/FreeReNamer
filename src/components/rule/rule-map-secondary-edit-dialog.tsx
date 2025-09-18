import { useState, useEffect, useRef } from 'react';
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
  IconPlus,
  IconAlertCircle,
  IconGripVertical
} from '@tabler/icons-react';
import type { Rule, RuleMapInfo, ListConfig, RULE_MAP_TYPE } from '@/lib/rules';
import { saveGlobalMapLists } from '@/lib/rules';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface RuleMapSecondaryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo>;
  onOverwriteRule: (updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo>) => void;
  onSaveInstanceOnly?: (updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo>) => void;
}

interface SortableItemProps {
  id: string;
  item: string;
  index: number;
  isDuplicate: boolean;
  hasAnyDuplicates: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
  totalItems: number;
}

function SortableItem({ 
  id, 
  item, 
  index, 
  isDuplicate, 
  hasAnyDuplicates,
  onMoveUp, 
  onMoveDown, 
  onDelete, 
  totalItems 
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled: hasAnyDuplicates // 当列表存在任何重复项时禁用拖拽
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 hover:bg-accent/50 group border-b ${
        isDuplicate ? 'bg-red-50 border-l-2 border-red-500' : ''
      } ${isDragging ? 'z-50 shadow-lg' : ''}`}
    >
      {/* 拖拽手柄 */}
      <div
        {...(hasAnyDuplicates ? {} : attributes)}
        {...(hasAnyDuplicates ? {} : listeners)}
        className={`flex items-center justify-center w-6 h-6 transition-opacity ${
          hasAnyDuplicates 
            ? 'text-muted-foreground/30 cursor-not-allowed opacity-50' 
            : 'text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100'
        }`}
        title={hasAnyDuplicates ? "存在重复项，无法拖拽" : "拖拽排序"}
      >
        <IconGripVertical className="h-4 w-4" />
      </div>

      <span className={`flex-1 text-sm font-mono ${
        isDuplicate ? 'text-red-600 font-medium' : ''
      }`}>
        {isDuplicate && <IconAlertCircle className="inline h-3 w-3 mr-1" />}
        {index + 1}. {item}
      </span>

      <div className={`flex items-center gap-1 transition-opacity ${
        hasAnyDuplicates ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          className="h-6 w-6 p-0"
          title="上移"
        >
          <IconArrowUp className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onMoveDown(index)}
          disabled={index === totalItems - 1}
          className="h-6 w-6 p-0"
          title="下移"
        >
          <IconArrowDown className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(index)}
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          title="删除"
        >
          <IconTrash className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 列表映射规则二次编辑对话框
 * 采用左右分栏设计，与列表编辑对话框保持一致
 */
export const RuleMapSecondaryEditDialog: React.FC<RuleMapSecondaryEditDialogProps> = ({
  open,
  onOpenChange,
  rule,
  onOverwriteRule,
  onSaveInstanceOnly
}) => {
  // 编辑状态
  const [includeExt, setIncludeExt] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [previewItems, setPreviewItems] = useState<string[]>([]);
  const [isRenamingForTemplate, setIsRenamingForTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [duplicateItems, setDuplicateItems] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  
  // 用于同步滚动的refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  /**
   * 处理textarea滚动，同步更新行号区域的滚动位置
   */
  const handleTextareaScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // 初始化数据
  useEffect(() => {
    if (open && rule) {
      setIncludeExt(rule.info.includeExt);
      const activeList = rule.info.lists[rule.info.activeListIndex];
      if (activeList) {
        const items = [...activeList.targetNames];
        const ids = items.map((_, index) => `item-${Date.now()}-${index}`);
        setTextContent(items.join('\n'));
        setPreviewItems(items);
        setItemIds(ids);
      }
    }
  }, [open, rule]);

  // 文本内容变化时更新预览和检查重复项
  useEffect(() => {
    const lines = textContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // 为新项目生成稳定的ID
    const newIds = lines.map((line, index) => {
      // 尝试从现有ID中找到匹配的项目
      const existingIndex = previewItems.findIndex(item => item === line);
      if (existingIndex !== -1 && itemIds[existingIndex]) {
        return itemIds[existingIndex];
      }
      // 如果找不到，生成新的ID
      return `item-${Date.now()}-${index}`;
    });
    
    setPreviewItems(lines);
    setItemIds(newIds);
    
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

  const activeList = rule?.info.lists[rule.info.activeListIndex] || { name: '', targetNames: [] };

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * 处理拖拽结束事件
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = itemIds.findIndex(id => id === active.id);
      const newIndex = itemIds.findIndex(id => id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(previewItems, oldIndex, newIndex);
        const newIds = arrayMove(itemIds, oldIndex, newIndex);
        
        setPreviewItems(newItems);
        setItemIds(newIds);
        setTextContent(newItems.join('\n'));
      }
    }
  };


  /**
   * 从预览区域删除项目
   */
  const handleDeletePreviewItem = (index: number) => {
    const newItems = previewItems.filter((_, i) => i !== index);
    const newIds = itemIds.filter((_, i) => i !== index);
    setPreviewItems(newItems);
    setItemIds(newIds);
    setTextContent(newItems.join('\n'));
  };

  /**
   * 在预览区域上移项目
   */
  const handleMoveUpPreviewItem = (index: number) => {
    if (index === 0) return;
    const newItems = [...previewItems];
    const newIds = [...itemIds];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    setPreviewItems(newItems);
    setItemIds(newIds);
    setTextContent(newItems.join('\n'));
  };

  /**
   * 在预览区域下移项目
   */
  const handleMoveDownPreviewItem = (index: number) => {
    if (index === previewItems.length - 1) return;
    const newItems = [...previewItems];
    const newIds = [...itemIds];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    setPreviewItems(newItems);
    setItemIds(newIds);
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
   * 保存规则实例
   * 只更新当前规则实例，不影响全局模板
   */
  const handleSaveInstance = async () => {
    // 先校验重复项
    if (!validateNoDuplicates()) {
      return;
    }
    
    try {
      // 深度克隆规则实例的lists，确保与全局模板完全隔离
      const clonedRuleLists = rule.info.lists.map(list => ({
        name: list.name,
        targetNames: [...list.targetNames]  // 深度克隆targetNames数组
      }));
      
      // 只修改当前活动列表的内容
      clonedRuleLists[rule.info.activeListIndex] = {
        ...activeList,
        targetNames: [...previewItems]  // 使用新的数组，不共享引用
      };
      
      const updatedRuleInfo: RuleMapInfo = {
        lists: clonedRuleLists,
        activeListIndex: rule.info.activeListIndex,
        includeExt
      };
      
      const updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo> = {
        ...rule,
        info: updatedRuleInfo
      };

      console.log('保存规则实例:', {
        originalRule: rule,
        updatedRule,
        activeListName: activeList.name,
        newTargetNames: previewItems,
        clonedLists: clonedRuleLists
      });

      // 使用专门的回调，不经过updateRule的全局保存逻辑
      if (onSaveInstanceOnly) {
        onSaveInstanceOnly(updatedRule);
      } else {
        // 如果没有提供专门的回调，则提示用户
        console.warn('onSaveInstanceOnly 回调未提供，无法保存规则实例');
      }
      onOpenChange(false);
    } catch (error) {
      console.error('保存规则实例失败:', error);
    }
  };

  /**
   * 覆盖模板
   * 更新当前规则实例并在全局列表映射规则下覆盖所使用的列表模板
   */
  const handleOverwrite = async () => {
    // 先校验重复项
    if (!validateNoDuplicates()) {
      return;
    }
    
    try {
      const updatedRuleInfo = createUpdatedRuleInfo();
      const updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo> = {
        ...rule,
        info: updatedRuleInfo
      };

      console.log('覆盖模板:', {
        originalRule: rule,
        updatedRule,
        activeListName: activeList.name,
        newTargetNames: previewItems
      });

      // 获取当前的全局模板配置
      const { getGlobalMapLists } = await import('@/lib/rules');
      const currentGlobalTemplates = await getGlobalMapLists();
      
      // 查找并覆盖当前使用的模板
      const updatedGlobalTemplates = currentGlobalTemplates.map(template => {
        if (template.name === activeList.name) {
          // 覆盖当前使用的模板
          return {
            ...template,
            targetNames: previewItems
          };
        }
        return template;
      });
      
      console.log('覆盖全局模板:', {
        originalTemplates: currentGlobalTemplates,
        updatedTemplates: updatedGlobalTemplates,
        targetTemplateName: activeList.name
      });
      
      // 更新全局模板配置（覆盖指定模板）
      await saveGlobalMapLists(updatedGlobalTemplates);
      
      console.log('全局模板配置已更新');

      onOverwriteRule(updatedRule);
      onOpenChange(false);
    } catch (error) {
      console.error('覆盖模板失败:', error);
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
   * 新建模板
   * 保存更新规则实例并且在全局列表映射规则下以此新建列表模板
   */
  const handleConfirmSaveAsNewTemplate = async () => {
    if (!newTemplateName.trim()) return;
    
    // 先校验重复项
    if (!validateNoDuplicates()) {
      return;
    }
    
    try {
      // 1. 获取当前的全局模板配置
      const { getGlobalMapLists } = await import('@/lib/rules');
      const currentGlobalTemplates = await getGlobalMapLists();
      
      // 2. 创建新的模板配置
      const newTemplateConfig: ListConfig = {
        name: newTemplateName.trim(),
        targetNames: previewItems
      };
      
      // 3. 将新模板添加到全局模板列表中（保持现有模板完全不变）
      const updatedGlobalTemplates = [...currentGlobalTemplates, newTemplateConfig];
      
      // 4. 更新规则实例：只修改当前活动列表的内容，不影响全局模板
      const updatedRuleLists = [...rule.info.lists];
      updatedRuleLists[rule.info.activeListIndex] = {
        ...activeList,
        targetNames: previewItems
      };
      
      const updatedRuleInfo: RuleMapInfo = {
        lists: updatedRuleLists,
        activeListIndex: rule.info.activeListIndex,
        includeExt
      };
      
      const updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo> = {
        ...rule,
        info: updatedRuleInfo
      };

      console.log('新建模板:', {
        originalRule: rule,
        updatedRule,
        newTemplateConfig,
        currentGlobalTemplates,
        updatedGlobalTemplates,
        templateCount: {
          before: currentGlobalTemplates.length,
          after: updatedGlobalTemplates.length
        }
      });
      
      // 5. 更新全局模板配置（添加新模板，不修改现有模板）
      await saveGlobalMapLists(updatedGlobalTemplates);
      
      console.log('全局模板配置已更新');
      
      // 6. 全局模板已更新（无需创建 finalUpdatedRule，因为我们只需要保存规则实例）

      // 7. 创建保存规则实例的数据（与"保存规则实例"按钮效果一致）
      // 创建一个只包含当前修改的规则实例副本，不影响全局模板
      const clonedRuleLists = rule.info.lists.map(list => ({
        name: list.name,
        targetNames: [...list.targetNames]  // 深度克隆targetNames数组
      }));
      
      // 只修改当前活动列表的内容
      clonedRuleLists[rule.info.activeListIndex] = {
        ...activeList,
        targetNames: [...previewItems]  // 使用新的数组，不共享引用
      };
      
      const instanceOnlyRuleInfo: RuleMapInfo = {
        lists: clonedRuleLists,
        activeListIndex: rule.info.activeListIndex,
        includeExt
      };
      
      const instanceOnlyRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo> = {
        ...rule,
        info: instanceOnlyRuleInfo
      };

      // 8. 先保存规则实例（与"保存规则实例"按钮效果一致）
      if (onSaveInstanceOnly) {
        onSaveInstanceOnly(instanceOnlyRule);
      }
      
      // 注意：不再调用 onOverwriteRule，因为用户期望的是保存规则实例而不是覆盖为全局模板
      
      setIsRenamingForTemplate(false);
      setNewTemplateName('');
      onOpenChange(false);
    } catch (error) {
      console.error('新建模板失败:', error);
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
              <div 
                ref={lineNumbersRef}
                className="bg-muted/30 border-r px-3 py-2 text-right text-sm font-mono text-muted-foreground select-none min-w-[3rem] shrink-0 overflow-hidden"
              >
                {textContent.split('\n').map((_, index) => (
                  <div key={index} className="leading-6 h-6">
                    {index + 1}
                  </div>
                ))}
              </div>
              {/* 文本编辑区域 */}
              <Textarea
                ref={textareaRef}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                onScroll={handleTextareaScroll}
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
              效果预览{duplicateItems.length > 0 ? '（存在重复项，拖拽已禁用）' : '（可拖拽排序）'}
            </label>
            <div className="flex-1 border rounded-md overflow-hidden">
              <ScrollArea className="h-full w-full">
                {previewItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    暂无内容
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={itemIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div>
                        {previewItems.map((item, index) => {
                          const isDuplicate = duplicateItems.includes(item);
                          const itemId = itemIds[index];
                          return (
                            <SortableItem
                              key={itemId}
                              id={itemId}
                              item={item}
                              index={index}
                              isDuplicate={isDuplicate}
                              hasAnyDuplicates={duplicateItems.length > 0}
                              onMoveUp={handleMoveUpPreviewItem}
                              onMoveDown={handleMoveDownPreviewItem}
                              onDelete={handleDeletePreviewItem}
                              totalItems={previewItems.length}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </ScrollArea>
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
                disabled={!newTemplateName.trim() || duplicateItems.length > 0}
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
              编辑完成后可以保存规则实例、覆盖现有模板或新建模板
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <IconX className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button 
                variant="outline" 
                onClick={handleOverwrite}
                disabled={duplicateItems.length > 0}
              >
                覆盖模板
              </Button>
              <Button 
                variant="outline" 
                onClick={handleStartSaveAsNewTemplate}
                disabled={duplicateItems.length > 0}
              >
                <IconPlus className="h-4 w-4 mr-2" />
                新建模板
              </Button>
              <Button 
                onClick={handleSaveInstance}
                disabled={duplicateItems.length > 0}
              >
                保存规则实例
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
