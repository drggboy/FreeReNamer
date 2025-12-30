# thumbnail-performance Specification

## Purpose
TBD - created by archiving change update-tauri-thumbnail-performance. Update Purpose after archive.
## Requirements
### Requirement: 桌面端文件列表虚拟化
桌面端文件列表 MUST 使用虚拟化渲染，仅渲染可见区域与合理的预渲染区间，以降低大量文件时的首屏渲染压力。

#### Scenario: 打开包含大量文件的文件夹
- **当** 用户在桌面端打开包含大量文件的文件夹
- **那么** 列表仅渲染可见行与预渲染行，不应一次性渲染全部行

### Requirement: 缩略图懒加载与并发限制
桌面端缩略图 MUST 在列表项可见时才触发加载，并限制同时进行的缩略图生成/读取数量。

#### Scenario: 滚动进入未显示的文件项
- **当** 用户滚动使未显示的文件项进入可见区域
- **那么** 仅该区域内的缩略图开始加载，且同时加载数量不超过并发上限

### Requirement: 超阈值降质的缩略图策略
当桌面端文件数量超过阈值（默认 150）时，缩略图 MUST 使用更小尺寸与更低质量生成，以减少 CPU 与内存压力。

#### Scenario: 文件数量超过阈值
- **当** 当前文件数量超过阈值
- **那么** 新生成的缩略图使用降质参数生成

### Requirement: 关闭缩略图的用户选项
桌面端 MUST 提供关闭缩略图的用户选项，关闭后不再生成缩略图并清理已有缩略图缓存。

#### Scenario: 用户关闭缩略图
- **当** 用户在桌面端关闭缩略图显示
- **那么** 列表不再生成缩略图且已生成的缩略图缓存被清理

