import type { RULE_SCRIPT_TYPE, Rule, RuleScriptInfo } from '@/lib/rule';
import type { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { TextEditor } from '@/components/ui/text-editor';
import './rule-script-form-worker';

export const RuleScriptForm: FC = () => {
  const form = useFormContext<Rule<typeof RULE_SCRIPT_TYPE, RuleScriptInfo>>();
  const script = form.watch('info.script') ?? '';

  return (
    <div className="size-full">
      <TextEditor
        value={script}
        onChange={(value) => form.setValue('info.script', value, { shouldDirty: true })}
        className="size-full"
        style={{ minHeight: '200px' }}
        language="javascript"
        wordWrap="on"
        lineNumbers="on"
      />
    </div>
  );
};

