import { Checkbox } from '@/components/ui/checkbox';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  type RULE_MAP_TYPE,
  type Rule,
  type RuleMapInfo,
  type ListConfig,
  saveGlobalMapLists,
} from '@/lib/rules';
import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { 
  IconTrash, 
  IconArrowUp, 
  IconArrowDown, 
  IconCheck, 
  IconX,
  IconPlus,
  IconEdit,
  IconListDetails
} from '@tabler/icons-react';

/**
 * 列表映射规则表单组件
 * 允许用户配置多个文件名映射列表
 */
export const RuleMapForm: FC = () => {
  const form = useFormContext<Rule<typeof RULE_MAP_TYPE, RuleMapInfo>>();
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [isAddingList, setIsAddingList] = useState(false);
  const [isEditingListName, setIsEditingListName] = useState(false);
  const [newListName, setNewListName] = useState('');
  
  // 获取当前列表配置
  const lists = form.watch('info.lists') || [];
  const activeListIndex = form.watch('info.activeListIndex') || 0;
  
  // 获取当前活动的列表
  const activeList = lists[activeListIndex] || { name: '', targetNames: [] };
  
  /**
   * 保存列表配置到全局存储
   */
  const saveListsToGlobal = async (updatedLists: ListConfig[]) => {
    try {
      await saveGlobalMapLists(updatedLists);
    } catch (error) {
      console.error('保存全局列表配置失败:', error);
    }
  };
  
  // 监听列表变化并保存到全局配置
  useEffect(() => {
    if (lists.length > 0) {
      saveListsToGlobal(lists);
    }
  }, [lists]);
  
  // 切换活动列表
  const handleSwitchList = (index: number) => {
    if (index >= 0 && index < lists.length) {
      form.setValue('info.activeListIndex', index);
    }
  };
  
  // 添加新列表
  const handleAddList = () => {
    if (!newListName.trim()) return;
    
    const newList: ListConfig = {
      name: newListName.trim(),
      targetNames: []
    };
    
    const updatedLists = [...lists, newList];
    form.setValue('info.lists', updatedLists);
    form.setValue('info.activeListIndex', updatedLists.length - 1);
    
    setNewListName('');
    setIsAddingList(false);
  };
  
  // 重命名当前列表
  const handleRenameList = () => {
    if (!newListName.trim()) return;
    
    const updatedLists = [...lists];
    updatedLists[activeListIndex] = {
      ...updatedLists[activeListIndex],
      name: newListName.trim()
    };
    
    form.setValue('info.lists', updatedLists);
    setNewListName('');
    setIsEditingListName(false);
  };
  
  // 删除当前列表
  const handleDeleteList = (index: number) => {
    if (lists.length <= 1) return; // 至少保留一个列表
    
    const updatedLists = lists.filter((_, i) => i !== index);
    form.setValue('info.lists', updatedLists);
    
    // 如果删除的是当前活动列表，则切换到第一个列表
    if (index === activeListIndex) {
      form.setValue('info.activeListIndex', 0);
    } 
    // 如果删除的列表索引小于当前活动列表索引，需要调整活动索引
    else if (index < activeListIndex) {
      form.setValue('info.activeListIndex', activeListIndex - 1);
    }
  };
  
  // 删除指定索引位置的名称
  const handleRemoveName = (index: number) => {
    if (!activeList) return;
    
    const updatedNames = activeList.targetNames.filter((_, i) => i !== index);
    const updatedLists = [...lists];
    updatedLists[activeListIndex] = {
      ...updatedLists[activeListIndex],
      targetNames: updatedNames
    };
    
    form.setValue('info.lists', updatedLists);
  };
  
  // 批量更新目标名称列表
  const handleBatchUpdate = () => {
    const names = batchText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const updatedLists = [...lists];
    updatedLists[activeListIndex] = {
      ...updatedLists[activeListIndex],
      targetNames: names
    };
    
    form.setValue('info.lists', updatedLists);
    setIsBatchEditing(false);
  };
  
  // 取消批量编辑
  const handleCancelBatchEdit = () => {
    setIsBatchEditing(false);
  };
  
  // 开始批量编辑
  const handleStartBatchEdit = () => {
    const text = activeList.targetNames.join('\n');
    setBatchText(text);
    setIsBatchEditing(true);
  };
  
  // 开始编辑列表名称
  const handleStartEditListName = () => {
    setNewListName(activeList.name);
    setIsEditingListName(true);
  };
  
  // 移动项目
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!activeList) return;
    
    const updatedNames = [...activeList.targetNames];
    
    if (direction === 'up' && index > 0) {
      [updatedNames[index-1], updatedNames[index]] = [updatedNames[index], updatedNames[index-1]];
    } else if (direction === 'down' && index < updatedNames.length - 1) {
      [updatedNames[index], updatedNames[index+1]] = [updatedNames[index+1], updatedNames[index]];
    } else {
      return;
    }
    
    const updatedLists = [...lists];
    updatedLists[activeListIndex] = {
      ...updatedLists[activeListIndex],
      targetNames: updatedNames
    };
    
    form.setValue('info.lists', updatedLists);
  };

  return (
    <div className="flex flex-col gap-y-4">
      <FormField
        control={form.control}
        name="info.includeExt"
        render={({ field }) => (
          <FormItem className="flex items-center space-x-2 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel>包含扩展名</FormLabel>
          </FormItem>
        )}
      />

      {/* 列表选择器 */}
      <div className="rounded border p-2">
        <div className="text-sm font-medium mb-2">列表配置</div>
        
        <div className="flex flex-wrap gap-2 mb-2">
          {lists.map((list, index) => (
            <Button
              key={index}
              type="button"
              variant={index === activeListIndex ? "default" : "outline"}
              size="sm"
              onClick={() => handleSwitchList(index)}
              className="flex items-center"
            >
              <IconListDetails className="h-4 w-4 mr-1" />
              {list.name}
              {lists.length > 1 && (
                <IconTrash
                  className="h-4 w-4 ml-2 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteList(index);
                  }}
                />
              )}
            </Button>
          ))}
          
          {isAddingList ? (
            <div className="flex items-center gap-x-1">
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="列表名称"
                className="w-32 h-8 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddList();
                  } else if (e.key === 'Escape') {
                    setIsAddingList(false);
                    setNewListName('');
                  }
                }}
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={handleAddList}
              >
                <IconCheck className="h-4 w-4" />
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsAddingList(false)}
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddingList(true)}
              className="flex items-center"
            >
              <IconPlus className="h-4 w-4 mr-1" />
              添加列表
            </Button>
          )}
        </div>
      </div>

      <FormField
        control={form.control}
        name="info.lists"
        render={() => (
          <FormItem>
            <div className="flex items-center justify-between mb-2">
              <FormLabel className="flex items-center gap-x-2">
                {isEditingListName ? (
                  <div className="flex items-center gap-x-1">
                    <Input
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="列表名称"
                      className="w-32 h-8 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRenameList();
                        } else if (e.key === 'Escape') {
                          setIsEditingListName(false);
                          setNewListName('');
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleRenameList}
                    >
                      <IconCheck className="h-4 w-4" />
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsEditingListName(false)}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span>{activeList.name || '默认列表'}</span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleStartEditListName}
                    >
                      <IconEdit className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </FormLabel>
              
              {/* 编辑按钮 */}
              {!isEditingListName && (
                <div className="flex flex-wrap gap-2">
                  {isBatchEditing ? (
                    <>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handleBatchUpdate}
                      >
                        <IconCheck className="h-4 w-4 mr-1" />
                        保存
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handleCancelBatchEdit}
                      >
                        <IconX className="h-4 w-4 mr-1" />
                        取消
                      </Button>
                    </>
                  ) : (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleStartBatchEdit}
                    >
                      编辑列表
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <FormDescription>
              按照显示顺序将原文件名映射为列表中的文件名
            </FormDescription>
            
            {isBatchEditing ? (
              <Textarea 
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder="每行一个目标文件名"
                rows={8}
                className="font-mono text-sm"
              />
            ) : (
              <>
                {/* 显示当前列表 */}
                <div className="flex flex-col gap-y-2 mb-2 max-h-[240px] overflow-y-auto border rounded p-2">
                  {!activeList || activeList.targetNames.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      暂无目标文件名，请点击"编辑列表"添加
                    </div>
                  ) : (
                    activeList.targetNames.map((name, index) => (
                      <div key={index} className="flex items-center gap-x-2 group">
                        <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                          {index + 1}
                        </div>
                        <div className="flex-1 border rounded p-2 bg-card">{name}</div>
                        <div className="flex gap-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMoveItem(index, 'up')}
                            disabled={index === 0}
                          >
                            <IconArrowUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMoveItem(index, 'down')}
                            disabled={index === activeList.targetNames.length - 1}
                          >
                            <IconArrowDown className="h-4 w-4" />
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveName(index)}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}; 