# list-mapping-templates Specification

## Purpose
TBD - created by archiving change add-cursor-rules-specs. Update Purpose after archive.
## Requirements
### Requirement: 区分全局模板与规则实例
系统 MUST 将全局模板与规则实例的列表数据隔离存储。

#### Scenario: 保存规则实例
- **当** 用户选择“保存规则实例”
- **那么** 仅更新当前规则实例，不影响全局模板

### Requirement: 覆盖模板同时更新全局模板与实例
系统 MUST 在“覆盖模板”操作中更新所选全局模板并同步当前规则实例。

#### Scenario: 覆盖模板
- **当** 用户覆盖所选模板
- **那么** 全局模板内容应被替换，且当前规则实例使用该模板内容

### Requirement: 新建模板追加到全局模板列表
系统 MUST 在“新建模板”操作中新增全局模板并更新当前规则实例使用新模板。

#### Scenario: 新建模板
- **当** 用户为列表映射规则新建模板
- **那么** 全局模板列表应新增该模板且当前规则实例切换为新模板

