# rule-ordering Specification

## Purpose
TBD - created by archiving change update-rule-ordering-and-script-editor. Update Purpose after archive.
## Requirements
### Requirement: 处理规则支持拖拽排序
系统 MUST 在处理规则列表中提供仅拖拽手柄可用的拖拽排序。

#### Scenario: 使用拖拽手柄调整规则顺序
- **当** 用户拖动某条规则的拖拽手柄到新位置
- **那么** 规则列表应立即显示新的顺序
- **并且** 新顺序必须保存到当前配置并触发规则预览刷新

