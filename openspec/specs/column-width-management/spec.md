# column-width-management Specification

## Purpose
TBD - created by archiving change add-user-visible-ui-specs. Update Purpose after archive.
## Requirements
### Requirement: 手动调整列宽受范围限制
系统 MUST 在手动拖拽调整列宽时应用最小与最大限制。

#### Scenario: 拖拽超过允许范围
- **当** 用户将列宽拖拽超过允许的范围
- **那么** 系统应限制在可用的最小或最大值

### Requirement: 智能重置按内容计算列宽
系统 MUST 在智能重置时基于文件名长度计算最优列宽并应用限制。

#### Scenario: 触发智能重置
- **当** 用户点击重置列宽
- **那么** 系统应按实际文件名长度计算并更新列宽

### Requirement: 重置期间显示加载状态
系统 MUST 在列宽重置计算期间展示加载状态并避免重复触发。

#### Scenario: 重置过程中再次触发
- **当** 列宽重置正在进行
- **那么** 系统应提示加载状态并阻止重复触发

