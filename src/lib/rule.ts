export * from './rules';

import { nanoid } from 'nanoid';
import { getFileInfo } from './file';
import {
  type RuleCommonInfo,
  ruleDefineDict,
  type Rule,
  type ExecRuleArgs,
  type RuleDefine,
} from './rules';

export function getRuleDefines() {
  return Object.values(ruleDefineDict);
}

export function getRuleDefine<
  T extends string = string,
  I extends RuleCommonInfo = RuleCommonInfo,
>(type: T) {
  return ruleDefineDict[type] as RuleDefine<T, I>;
}

export async function getRuleTypeDefaultInfo<
  I extends RuleCommonInfo = RuleCommonInfo,
>(type: string): Promise<I> {
  const result = getRuleDefine(type).getDefaultInfo();
  return result instanceof Promise ? await result : result as I;
}

export async function getRuleTypeDefaultValue<
  T extends string = string,
  I extends RuleCommonInfo = RuleCommonInfo,
>(ruleType: T): Promise<Rule<T, I>> {
  return {
    id: nanoid(),
    type: ruleType,
    info: await getRuleTypeDefaultInfo(ruleType),
    name: '',
    enabled: true,
  } as Rule<T, I>;
}

export async function execRule<T extends string, I extends RuleCommonInfo>(
  rule: Rule<T, I>,
  args: ExecRuleArgs,
): Promise<string> {
  const result = await getRuleDefine(rule.type).exec(rule.info, args);

  return `${result.trim()}${rule.info.includeExt ? '' : args.fileInfo.ext}`;
}

export async function execRules(
  rules: Rule[],
  args: ExecRuleArgs,
): Promise<string> {
  if (rules.length === 0) {
    return args.fileInfo.fullName;
  }

  const rule = rules[0];
  const result = await execRule(rule, args);
  const newFileInfo = await getFileInfo(result);

  return execRules(rules.slice(1), { ...args, fileInfo: newFileInfo });
}
