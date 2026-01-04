# 变更：支持规则拖拽排序并修复脚本编辑区选中反馈

## Why
- 处理规则顺序会影响最终重命名结果，需要更直观的排序方式。
- Tauri 桌面端脚本编辑区选中文本无视觉反馈，影响可用性。

## What Changes
- 处理规则列表支持仅拖拽手柄排序，拖拽完成后立即保存并刷新预览。
- 脚本规则编辑区复用 TextEditor 的浅色主题与选中高亮策略。

## 影响
- 受影响规范：rule-ordering、rule-script-editor
- 受影响代码：src/components/rule/rules-panel.tsx、src/components/rule/rule-item.tsx、src/components/rule/rule-type-froms/rule-script-form.tsx、src/components/ui/text-editor.tsx
