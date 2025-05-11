import type { RuleCommonInfo, RuleDefine } from './base';

export const RULE_SCRIPT_TYPE = 'script';

export interface RuleScriptInfo extends RuleCommonInfo {
  script: string;
}

export const RULE_SCRIPT_DEFINE: RuleDefine<
  typeof RULE_SCRIPT_TYPE,
  RuleScriptInfo
> = {
  type: RULE_SCRIPT_TYPE,
  label: '脚本',
  getDefaultInfo: () => ({
    script:
      '/**\n' +
      ' * 脚本规则 - 可用变量和函数说明\n' +
      ' * \n' +
      ' * args 包含以下信息:\n' +
      ' * - fileInfo: 文件信息对象\n' +
      ' *   - fileInfo.name: 不含扩展名的文件名\n' +
      ' *   - fileInfo.ext: 扩展名 (例如 ".jpg")\n' +
      ' *   - fileInfo.fullName: 完整文件名 (带扩展名)\n' +
      ' *   - fileInfo.timestamp: 文件修改时间戳 (Unix 时间戳)\n' +
      ' *   - fileInfo.timeString: 格式化的时间字符串\n' +
      ' *   - fileInfo.isImage: 是否为图片文件 (boolean)\n' +
      ' * \n' +
      ' * - index: 当前文件在列表中的索引 (从0开始)\n' +
      ' * \n' +
      ' * 您需要返回一个字符串作为新文件名\n' +
      ' */\n' +
      'const { fileInfo, index } = args;\n\n' +
      '// ============ 在此编写您的代码 ============\n\n' +
      '// 示例: 添加三位数字前缀\n' +
      'const paddedIndex = (index + 1).toString().padStart(3, \'0\');\n' +
      'return paddedIndex + \'_\' + fileInfo.name;\n',
    includeExt: true,
  }),
  getDescription: () => {
    return '自定义脚本';
  },
  exec: async (ruleInfo, args) => {
    return new Function('args', ruleInfo.script)(args);
  },
};
