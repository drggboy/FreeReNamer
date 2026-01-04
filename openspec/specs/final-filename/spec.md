# final-filename Specification

## Purpose
TBD - created by archiving change add-cursor-rules-specs. Update Purpose after archive.
## Requirements
### Requirement: 最终文件名列反映实际执行名称
系统 MUST 将“最终文件名”列作为实际执行的目标名称来源。

#### Scenario: 用户未手动修改
- **当** 用户未修改最终文件名
- **那么** 列应显示规则预览结果或原始文件名

#### Scenario: 用户已手动修改
- **当** 用户修改最终文件名
- **那么** 列应显示用户输入并在执行时使用该值

### Requirement: 仅在未手动修改时同步规则预览
系统 MUST 仅在用户未手动修改最终文件名时同步规则预览结果。

#### Scenario: 用户已开始手动修改
- **当** 用户对某个文件名进行了手动编辑
- **那么** 后续规则预览变化不应覆盖用户输入

