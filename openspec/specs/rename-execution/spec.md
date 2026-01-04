# rename-execution Specification

## Purpose
TBD - created by archiving change add-cursor-rules-specs. Update Purpose after archive.
## Requirements
### Requirement: 统一重命名执行流程
系统 MUST 在一次执行流程中合并手动最终文件名与规则重命名结果。

#### Scenario: 同时存在手动修改与规则配置
- **当** 用户为部分文件输入最终文件名并配置规则后执行重命名
- **那么** 已手动修改的文件应使用用户输入
- **并且** 未手动修改的文件应按规则链计算目标名称

### Requirement: Tauri 使用两阶段重命名避免交换冲突
系统 MUST 在 Tauri 平台使用临时文件名的两阶段重命名以避免名称交换冲突。

#### Scenario: 两个文件交换名称
- **当** 文件 A 与文件 B 的目标名称互换
- **那么** 系统应先改为临时名再执行最终重命名以保证成功

