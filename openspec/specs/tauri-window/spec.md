# tauri-window Specification

## Purpose
TBD - created by archiving change update-tauri-desktop-layout. Update Purpose after archive.
## Requirements
### Requirement: Tauri 初始窗口宽度
桌面端主窗口 MUST 以 1100px 作为初始宽度启动。

#### Scenario: 启动桌面端应用
- **当** 用户启动桌面端应用
- **那么** 主窗口初始宽度为 1100px

### Requirement: Tauri 最小窗口宽度
桌面端主窗口 MUST 将最小宽度限制为 1100px。

#### Scenario: 尝试缩窄窗口宽度
- **当** 用户尝试将窗口宽度缩小到小于 1100px
- **那么** 窗口宽度不会小于 1100px

### Requirement: Tauri 最小窗口高度
桌面端主窗口 MUST 将最小高度限制为 600px。

#### Scenario: 尝试缩小窗口高度
- **当** 用户尝试将窗口高度缩小到小于 600px
- **那么** 窗口高度不会小于 600px

