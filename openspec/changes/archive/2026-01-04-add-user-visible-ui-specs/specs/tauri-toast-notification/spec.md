## ADDED Requirements
### Requirement: Tauri 生产环境 Toast 位置固定且不遮挡关键操作
系统 MUST 在 Tauri 生产环境将 Toast 固定在右上方且不遮挡关键操作按钮。

#### Scenario: 执行完成提示
- **当** 重命名执行完成后显示 Toast
- **那么** Toast 应出现在右上区域并避免遮挡执行按钮

### Requirement: Toast 类型需具备清晰视觉区分
系统 MUST 为 success、error、info 类型 Toast 提供可区分的视觉样式。

#### Scenario: 成功与失败提示
- **当** 显示 success 与 error Toast
- **那么** 用户应能通过样式明确区分不同类型
