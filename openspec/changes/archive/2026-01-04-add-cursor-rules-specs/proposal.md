# 变更：将 .cursor 规则提炼为 OpenSpec 规范

## Why
- 关键规则长期沉淀在 .cursor/rules，缺少统一的规范载体与校验入口。
- 需要将既有行为转换为可追踪、可验证的规范能力，便于后续维护。

## What Changes
- 提炼 6 个能力规范：rename-execution、rename-conflicts、final-filename、rule-system、list-mapping-templates、text-editor-selection。
- 为每个能力编写 ADDED Requirements 增量规范。

## 影响
- 受影响规范：rename-execution、rename-conflicts、final-filename、rule-system、list-mapping-templates、text-editor-selection
- 来源文档：.cursor/rules/02-rename-execution.mdc、05-rule-system.mdc、07-conflict-detection.mdc、09-final-filename-logic.mdc、13-list-mapping-rule-ui.mdc、14-template-management-logic.mdc、25-text-selection-production-fix.mdc
