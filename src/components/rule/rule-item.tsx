import { getRuleDefine, type Rule } from '@/lib/rule';
import { useMemo, type FC } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '../ui/context-menu';
import { Switch } from '../ui/switch';
import { Badge } from '@/components/ui/badge';
import { RULE_MAP_TYPE, type RuleMapInfo } from '@/lib/rules';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical } from '@tabler/icons-react';

export interface RuleItemProps {
  rule: Rule;
  onDel?: () => void;
  onSwitch?: (checked: boolean) => void;
  onEdit?: () => void;
  onSecondaryEdit?: () => void;
  onRename?: () => void;
}

export const RuleItem: FC<RuleItemProps> = ({
  rule,
  onDel,
  onSwitch,
  onEdit,
  onSecondaryEdit,
  onRename,
}) => {
  const label = useMemo(() => {
    return getRuleDefine(rule.type).label;
  }, [rule.type]);

  const description = useMemo(() => {
    return getRuleDefine(rule.type).getDescription(rule.info);
  }, [rule.type, rule.info]);

  // 获取列表映射规则的模板信息
  const templateInfo = useMemo(() => {
    if (rule.type === RULE_MAP_TYPE) {
      const mapRule = rule as Rule<typeof RULE_MAP_TYPE, RuleMapInfo>;
      const { lists, activeListIndex } = mapRule.info;
      
      if (lists.length > 0 && activeListIndex >= 0 && activeListIndex < lists.length) {
        const activeList = lists[activeListIndex];
        return {
          templateName: activeList.name,
          itemCount: activeList.targetNames.length
        };
      }
    }
    return null;
  }, [rule]);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  function handleDel() {
    onDel?.();
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className="grid min-h-8 w-full grid-cols-[2.5rem_25%_100px_1fr_3rem] divide-x break-all text-sm hover:bg-neutral-100 allow-context-menu"
        >
          <div className="flex size-full items-center justify-center">
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
              aria-label="拖拽排序"
              title="拖拽排序"
            >
              <IconGripVertical className="h-4 w-4" />
            </button>
          </div>
          <span className="flex size-full items-center px-2 py-1">
            <span>{rule.name}</span>
          </span>
          <span className="flex size-full items-center justify-center px-2 py-1">
            {label}
          </span>
          <div className="flex size-full items-center px-2 py-1">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <span>{description}</span>
              {templateInfo && (
                <>
                  <Badge variant="outline" className="text-xs">
                    模板: {templateInfo.templateName}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {templateInfo.itemCount} 项
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex size-full items-center justify-center">
            <Switch checked={rule.enabled} onCheckedChange={onSwitch} />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {rule.type === RULE_MAP_TYPE && onSecondaryEdit ? (
          <ContextMenuItem onClick={onSecondaryEdit}>编辑</ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={onEdit}>编辑</ContextMenuItem>
        )}
        {onRename && (
          <ContextMenuItem onClick={onRename}>重命名</ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDel}>删除</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
