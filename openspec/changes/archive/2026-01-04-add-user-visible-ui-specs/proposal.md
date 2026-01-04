# 变更：补充用户可感知且稳定的 UI 行为规范

## Why
- 当前仍有部分用户可感知行为仅存在于 .cursor/rules，缺少统一的 OpenSpec 规范沉淀。
- 需要将稳定行为固化为规范，便于未来变更时对齐预期。

## What Changes
- 提炼 4 个能力规范：execution-ui-disable、column-width-management、media-viewer-selection、tauri-toast-notification。
- 为每个能力补充 ADDED Requirements 增量规范。

## 影响
- 受影响规范：execution-ui-disable、column-width-management、media-viewer-selection、tauri-toast-notification
- 来源文档：.cursor/rules/12-execution-state-ui-disable.mdc、17-column-width-management.mdc、18-media-viewer-selection.mdc、20-tauri-toast-notification.mdc
