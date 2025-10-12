# 生产环境文本选择高亮修复总结

## 问题描述

在Tauri打包的生产环境exe文件中，编辑列表映射规则时，用鼠标拖动选中文字没有高亮效果（阴影/背景色），导致用户不确定选中了哪些文字进行编辑。

## 调查过程

### 尝试1: CSS `::selection` 样式
- ❌ 在生产环境完全不工作
- 尝试了各种选择器和`!important`，都无效

### 尝试2: Monaco Editor主题配置
- ❌ 设置`editor.selectionBackground`无效
- Monaco的内置选择层在WebView2中无法渲染

### 尝试3: JavaScript事件检查
- 发现`selectstart`事件被`disable-context-menu`处理器阻止
- ✅ 修复：允许Monaco Editor内的选择事件

### 尝试4: JavaScript手动高亮（最终方案）
- ✅ 监听Monaco的`onDidChangeCursorSelection`事件
- ✅ 手动创建DOM元素显示高亮
- ✅ 使用Monaco API精确计算位置
- ✅ 支持中文和变宽字体

## 最终解决方案

### 核心文件修改

#### 1. `src/routes/__root.tsx`
允许Monaco Editor内的文本选择：
```typescript
const handleSelectStart = (e: Event) => {
  const target = e.target as HTMLElement;
  
  // 允许Monaco Editor中的文本选择
  const isInMonacoEditor = target.closest('.monaco-editor');
  if (isInMonacoEditor) {
    e.stopPropagation();
    return true;
  }
  // ... 其他逻辑
};
```

#### 2. `src/components/ui/text-editor.tsx`
手动创建选择高亮层（仅在生产环境）：
```typescript
if (isProdTauri) {
  // 创建overlay容器
  const highlightOverlay = document.createElement('div');
  
  // 监听选择变化
  editorRef.current.onDidChangeCursorSelection(() => {
    // 保存选择位置
    savedSelection = { start, end };
    updateHighlightPosition();
  });
  
  // 监听滚动
  editorRef.current.onDidScrollChange(() => {
    updateHighlightPosition();
  });
}
```

#### 3. `src/styles.css`
简化CSS（只保留必要的user-select设置）：
```css
.disable-context-menu .monaco-editor,
.disable-context-menu .monaco-editor * {
  -webkit-user-select: text !important;
  user-select: text !important;
}
```

### 关键技术点

1. **精确位置计算**：使用`getOffsetForColumn()`而不是固定字符宽度
2. **滚动处理**：减去`scrollTop`和`scrollLeft`使高亮跟随文本
3. **中文支持**：Monaco API自动处理不同宽度的字符
4. **性能优化**：只在选择变化时重新创建DOM

## 测试结果

✅ **英文文本**：选择高亮精确对齐
✅ **中文文本**：选择高亮精确对齐  
✅ **混合文本**：英文、中文、数字混合也精确对齐
✅ **滚动**：高亮正确跟随文本移动
✅ **多行选择**：跨行选择连续高亮
✅ **开发环境**：不受影响，使用Monaco默认样式

## 文件清单

### 修改的文件
- `src/routes/__root.tsx` - 允许Monaco Editor文本选择
- `src/components/ui/text-editor.tsx` - 添加自定义选择高亮层
- `src/styles.css` - 简化CSS，移除无效的::selection样式

### 删除的文件
- `src/lib/selection-debug.ts` - 调试工具（不再需要）
- `public/debug-selection.html` - 调试页面（不再需要）

### 新增的文档
- `docs/text-selection-fix-summary.md` - 本文档
- `.cursor/rules/25-text-selection-production-fix.mdc` - 规则文档（已更新）

## 配置说明

### 颜色和透明度
- 颜色：`#ADD6FF`（淡蓝色）
- 透明度：50%
- 可在`src/components/ui/text-editor.tsx`中修改

### 环境判断
```typescript
const isProductionTauri = () => {
  const isProduction = import.meta.env.PROD;
  const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;
  return isProduction && isTauri;
};
```

只在生产环境的Tauri应用中启用自定义高亮层。

## 经验总结

1. **WebView2限制**：系统WebView对某些CSS特性支持不完整
2. **调试困难**：生产环境无开发者工具，需要添加日志输出
3. **API优先**：使用库提供的API比CSS hack更可靠
4. **渐进增强**：在不影响开发环境的前提下修复生产环境问题

## 相关Issue

如遇到类似问题，可参考：
- Monaco Editor在WebView中的渲染问题
- Tauri应用中的文本选择问题
- WebView2的CSS兼容性问题

