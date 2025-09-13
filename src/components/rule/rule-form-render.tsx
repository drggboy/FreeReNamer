import type { FC } from 'react';
import { RuleReplaceForm } from './rule-type-froms/rule-replace-form';
import { RuleDeleteForm } from './rule-type-froms/rule-delete-form';
import { RuleFormatForm } from './rule-type-froms/rule-format-form';
import { RuleTemplateForm } from './rule-type-froms/rule-template-form';
import { RuleScriptForm } from './rule-type-froms/rule-script-form';
import {
  RULE_DELETE_TYPE,
  RULE_FORMAT_TYPE,
  RULE_INSERT_TYPE,
  RULE_MAP_TYPE,
  RULE_REPLACE_TYPE,
  RULE_SCRIPT_TYPE,
  RULE_TEMPLATE_TYPE,
} from '@/lib/rules';
import { RuleInsertForm } from './rule-type-froms/rule-insert-form';
import { RuleMapForm } from './rule-type-froms/rule-map-form';

export interface RuleFormRenderProps {
  type: string;
}

export const RuleFormRender: FC<RuleFormRenderProps> = ({ type }) => {
  switch (type) {
    case RULE_REPLACE_TYPE:
      return <RuleReplaceForm />;

    case RULE_DELETE_TYPE:
      return <RuleDeleteForm />;

    case RULE_FORMAT_TYPE:
      return <RuleFormatForm />;

    case RULE_SCRIPT_TYPE:
      return <RuleScriptForm />;

    case RULE_TEMPLATE_TYPE:
      return <RuleTemplateForm />;

    case RULE_INSERT_TYPE:
      return <RuleInsertForm />;
      
    case RULE_MAP_TYPE:
      return <RuleMapForm />;

    default:
      return null;
  }
};
