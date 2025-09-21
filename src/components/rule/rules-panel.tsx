import { useEffect, useState, type FC } from 'react';
import { Button } from '../ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileQueryOptions } from '@/lib/queries/profile';
import { RuleItem } from './rule-item';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { RuleEditPanel } from './rule-edit-panel';
import { useForm } from 'react-hook-form';
import { Form } from '../ui/form';
import {
  getRuleTypeDefaultValue,
  getRuleDefine,
  type Rule,
  RULE_REPLACE_TYPE,
} from '@/lib/rule';
import { updateProfile } from '@/lib/profile';
import { QueryType } from '@/lib/query';
import { ScrollArea } from '../ui/scroll-area';
import { RuleEditDialog } from './rule-edit-dialog';
import { RuleMapSecondaryEditDialog } from './rule-map-secondary-edit-dialog';
import { RULE_MAP_TYPE, type RuleMapInfo, saveGlobalMapLists } from '@/lib/rules';
import { RuleNameInputDialog } from './rule-name-input-dialog';

/**
 * 获取规则的默认名称
 * 对于列表映射规则，返回当前活动列表的名称
 * 对于其他规则类型，返回规则类型的标签
 */
function getDefaultRuleName(rule: Rule): string {
  if (rule.type === RULE_MAP_TYPE) {
    const mapRule = rule as Rule<typeof RULE_MAP_TYPE, RuleMapInfo>;
    const { lists, activeListIndex } = mapRule.info;
    
    // 如果有有效的列表配置且活动索引有效，返回活动列表的名称
    if (lists.length > 0 && activeListIndex >= 0 && activeListIndex < lists.length) {
      return lists[activeListIndex].name;
    }
  }
  
  // 默认返回规则类型的标签
  return getRuleDefine(rule.type).label;
}

export interface RulesPanelProps {
  profileId: string;
}

export const RulesPanel: FC<RulesPanelProps> = ({ profileId }) => {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQueryOptions(profileId));
  const [addRuleDialogOpened, setAddRuleDialogOpened] = useState(false);
  const [targetEditRule, setTargetEditRule] = useState<Rule | undefined>();
  const [nameInputDialogOpened, setNameInputDialogOpened] = useState(false);
  const [pendingRule, setPendingRule] = useState<Rule | null>(null);
  const [secondaryEditRule, setSecondaryEditRule] = useState<Rule<typeof RULE_MAP_TYPE, RuleMapInfo> | undefined>();
  const [renameRuleDialogOpened, setRenameRuleDialogOpened] = useState(false);
  const [targetRenameRule, setTargetRenameRule] = useState<Rule | undefined>();

  const { mutate: addRule } = useMutation({
    mutationFn: async (rule: Rule) => {
      if (!profile) {
        return;
      }

      // 如果是列表映射规则，同时更新全局配置
      if (rule.type === RULE_MAP_TYPE) {
        const mapRule = rule as Rule<typeof RULE_MAP_TYPE, RuleMapInfo>;
        try {
          await saveGlobalMapLists(mapRule.info.lists);
        } catch (error) {
          console.error('保存全局列表配置失败:', error);
        }
      }

      return updateProfile(profileId, {
        ...profile,
        rules: [...profile.rules, rule],
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: [QueryType.Profile, { id: profileId }],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryType.FileItemInfo, { profileId }],
      });
    },
  });

  const { mutate: deleteRule } = useMutation({
    mutationFn: async (ruleId: string) => {
      if (!profile) {
        return;
      }

      return updateProfile(profileId, {
        ...profile,
        rules: profile.rules.filter((rule) => rule.id !== ruleId),
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: [QueryType.Profile, { id: profileId }],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryType.FileItemInfo, { profileId }],
      });
    },
  });

  const { mutate: updateRuleChecked } = useMutation({
    mutationFn: async ({
      ruleId,
      checked,
    }: { ruleId: string; checked: boolean }) => {
      if (!profile) {
        return;
      }

      return updateProfile(profileId, {
        ...profile,
        rules: profile.rules.map((rule) => {
          if (rule.id === ruleId) {
            return {
              ...rule,
              enabled: checked,
            };
          }

          return rule;
        }),
      });
    },

    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: [QueryType.Profile, { id: profileId }],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryType.FileItemInfo, { profileId }],
      });
    },
  });

  const { mutate: updateRule } = useMutation({
    mutationFn: async (rule: Rule) => {
      if (!profile) {
        return;
      }

      // 如果是列表映射规则，同时更新全局配置
      if (rule.type === RULE_MAP_TYPE) {
        const mapRule = rule as Rule<typeof RULE_MAP_TYPE, RuleMapInfo>;
        try {
          await saveGlobalMapLists(mapRule.info.lists);
        } catch (error) {
          console.error('保存全局列表配置失败:', error);
        }
      }

      return updateProfile(profileId, {
        ...profile,
        rules: profile.rules.map((r) => {
          if (rule.id === r.id) {
            return {
              ...r,
              ...rule,
            };
          }

          return r;
        }),
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: [QueryType.Profile, { id: profileId }],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryType.FileItemInfo, { profileId }],
      });
    },
  });

  const form = useForm<Rule>({
    defaultValues: {
      id: '',
      type: RULE_REPLACE_TYPE,
      info: { includeExt: false },
      name: '',
      enabled: true,
    } as Rule,
  });

  function handleAddRule() {
    setAddRuleDialogOpened(true);
  }

  function onSubmit(values: Rule) {
    // 设置待处理的规则并打开名称输入对话框
    setPendingRule(values);
    setAddRuleDialogOpened(false);
    setNameInputDialogOpened(true);
  }

  function onUpdateRule(values: Rule) {
    updateRule(values);

    setTargetEditRule(undefined);
  }

  function onCloseRuleEditDialog() {
    setTargetEditRule(undefined);
  }

  /**
   * 处理二次编辑
   */
  function handleSecondaryEdit(rule: Rule) {
    if (rule.type === RULE_MAP_TYPE) {
      setSecondaryEditRule(rule as Rule<typeof RULE_MAP_TYPE, RuleMapInfo>);
    }
  }

  /**
   * 处理重命名
   */
  function handleRename(rule: Rule) {
    setTargetRenameRule(rule);
    setRenameRuleDialogOpened(true);
  }

  /**
   * 关闭二次编辑对话框
   */
  function onCloseSecondaryEditDialog() {
    setSecondaryEditRule(undefined);
  }


  /**
   * 覆盖现有规则
   */
  function handleOverwriteRule(updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo>) {
    updateRule(updatedRule);
  }

  /**
   * 保存规则实例（不影响全局模板）
   */
  function handleSaveInstanceOnly(updatedRule: Rule<typeof RULE_MAP_TYPE, RuleMapInfo>) {
    // 直接更新profile，绕过updateRule的全局保存逻辑
    if (!profile) return;
    
    const updatedProfile = {
      ...profile,
      rules: profile.rules.map((r) => {
        if (updatedRule.id === r.id) {
          return {
            ...r,
            ...updatedRule,
          };
        }
        return r;
      }),
    };
    
    // 直接调用updateProfile，不经过updateRule mutation
    updateProfile(profileId, updatedProfile).then(() => {
      // 手动触发查询刷新
      queryClient.invalidateQueries({
        queryKey: [QueryType.Profile, { id: profileId }],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryType.FileItemInfo, { profileId }],
      });
    }).catch((error) => {
      console.error('保存规则实例失败:', error);
    });
  }

  function onRuleNameConfirm(name: string) {
    if (pendingRule) {
      addRule({ ...pendingRule, name });
      setPendingRule(null);
    }
    setNameInputDialogOpened(false);
  }

  function onRuleNameCancel() {
    setPendingRule(null);
    setNameInputDialogOpened(false);
  }

  function onRenameConfirm(name: string) {
    if (targetRenameRule) {
      updateRule({ ...targetRenameRule, name });
      setTargetRenameRule(undefined);
    }
    setRenameRuleDialogOpened(false);
  }

  function onRenameCancel() {
    setTargetRenameRule(undefined);
    setRenameRuleDialogOpened(false);
  }

  useEffect(() => {
    if (!addRuleDialogOpened) {
      getRuleTypeDefaultValue(RULE_REPLACE_TYPE).then(defaultValue => {
        form.reset(defaultValue);
      });
    }
  }, [addRuleDialogOpened, form.reset]);

  return (
    <>
      <div className="size-full">
        <div className="flex w-full items-center pb-4">
          <Button size="sm" onClick={handleAddRule}>
            添加规则
          </Button>
        </div>
        <div className="grid h-8 grid-cols-[25%_100px_1fr_3rem] divide-x divide-neutral-300 rounded-t bg-neutral-200 text-sm">
          <span className="flex size-full items-center px-2">名称</span>
          <span className="flex size-full items-center justify-center px-2">
            规则
          </span>
          <span className="flex size-full items-center px-2">说明</span>
          <div />
        </div>
        <ScrollArea className="h-[calc(100%-5rem)] w-full rounded-b border border-t-0">
          <div className="w-full divide-y">
            {profile?.rules?.map((rule) => {
              return (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  onDel={() => deleteRule(rule.id)}
                  onSwitch={(checked) =>
                    updateRuleChecked({ ruleId: rule.id, checked })
                  }
                  onEdit={() => setTargetEditRule(rule)}
                  onSecondaryEdit={() => handleSecondaryEdit(rule)}
                  onRename={() => handleRename(rule)}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>
      <Dialog open={addRuleDialogOpened} onOpenChange={setAddRuleDialogOpened}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          className="grid h-[70vh] w-full grid-cols-1 grid-rows-[max-content_1fr]"
        >
          <DialogHeader>
            <DialogTitle>添加规则</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid size-full grid-rows-[1fr_max-content] gap-y-4 overflow-hidden"
              autoComplete="off"
            >
              <RuleEditPanel />
              <div className="flex w-full items-end justify-end gap-x-2">
                <DialogClose asChild>
                  <Button variant="ghost">取消</Button>
                </DialogClose>
                <Button type="submit">添加</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <RuleEditDialog
        rule={targetEditRule}
        onSubmit={onUpdateRule}
        onOpenedChange={onCloseRuleEditDialog}
      />
      <RuleNameInputDialog
        open={nameInputDialogOpened}
        defaultName={pendingRule ? getDefaultRuleName(pendingRule) : ''}
        onConfirm={onRuleNameConfirm}
        onCancel={onRuleNameCancel}
      />
      
      {/* 重命名对话框 */}
      <RuleNameInputDialog
        open={renameRuleDialogOpened}
        defaultName={targetRenameRule?.name || ''}
        onConfirm={onRenameConfirm}
        onCancel={onRenameCancel}
      />
      
      {/* 列表映射规则二次编辑对话框 */}
      {secondaryEditRule && (
        <RuleMapSecondaryEditDialog
          open={!!secondaryEditRule}
          onOpenChange={onCloseSecondaryEditDialog}
          rule={secondaryEditRule}
          onOverwriteRule={handleOverwriteRule}
          onSaveInstanceOnly={handleSaveInstanceOnly}
        />
      )}
    </>
  );
};
