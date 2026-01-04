# text-editor-selection Specification

## Purpose
TBD - created by archiving change add-cursor-rules-specs. Update Purpose after archive.
## Requirements
### Requirement: Tauri 生产环境文本选区可见
系统 MUST 在 Tauri 生产环境中保证 TextEditor 选中区域可见。

#### Scenario: 拖拽选中文本
- **当** 用户在 Tauri 生产环境拖拽选择文本
- **那么** 选中区域应显示可见高亮

#### Scenario: 选区随滚动保持正确
- **当** 用户滚动编辑器视图
- **那么** 已选中的高亮应随文本位置同步

