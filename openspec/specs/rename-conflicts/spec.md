# rename-conflicts Specification

## Purpose
TBD - created by archiving change add-cursor-rules-specs. Update Purpose after archive.
## Requirements
### Requirement: 执行前必须进行重命名冲突检查
系统 MUST 在执行重命名前检查所有目标名称冲突并阻止执行。

#### Scenario: 重复的重命名目标
- **当** 多个文件将被重命名为同一名称
- **那么** 系统应阻止执行并提示重复目标

#### Scenario: 与已移除文件名称冲突
- **当** 重命名目标与已从列表移除但仍存在的文件名称冲突
- **那么** 系统应阻止执行并提示冲突来源

