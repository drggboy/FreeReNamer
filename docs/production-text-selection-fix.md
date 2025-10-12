# 生产环境文本选择高亮修复

## 问题描述

在Tauri打包的生产环境exe文件中，编辑列表映射规则时，使用Monaco Editor文本编辑器选中文字时没有高亮显示效果（阴影/背景色），导致用户不确定选中了哪些文字。

## 根本原因

Tauri生产环境使用系统WebView（Windows上是WebView2），与开发环境的完整Chromium引擎存在渲染差异：

1. **CSS样式差异**: 系统WebView可能不完全支持某些CSS特性或默认样式
2. **Monaco Editor依赖**: Monaco Editor的选择高亮依赖于特定的CSS类和DOM结构
3. **样式优先级**: 生产环境中某些默认样式可能被覆盖或缺失

## 解决方案

### 1. CSS强制样式覆盖

在 `src/styles.css` 中添加了针对Monaco Editor的选择高亮样式：

```css
/* Monaco Editor 选中文本的高亮样式 - 针对生产环境WebView */

/* 选择层的背景色 - Monaco Editor 的主要选择样式 */
.monaco-editor .view-overlays .current-line-exact-selection,
.monaco-editor .view-overlays .selected-text,
.monaco-editor .view-overlays .current-line ~ .selected-text {
  background-color: rgba(173, 214, 255, 0.7) !important;
}

/* 选择装饰器 - Monaco用这个来显示选中区域 */
.monaco-editor .selections-layer .selection {
  background-color: rgba(173, 214, 255, 0.7) !important;
}

/* 浏览器原生选择样式 - 作为额外的回退 */
.monaco-editor ::selection {
  background-color: rgba(173, 214, 255, 0.7) !important;
  color: inherit !important;
}
```

### 2. 样式层级说明

修复方案采用多层次覆盖策略：

1. **Monaco选择层**: 针对Monaco Editor内部的选择DOM结构
2. **浏览器原生选择**: 使用`::selection`伪元素作为回退
3. **强制优先级**: 使用`!important`确保在WebView中生效

## 测试方法

### 开发环境测试
```bash
pnpm dev
```
打开列表映射规则编辑对话框，选中文字应该有淡蓝色高亮。

### 生产环境测试
```bash
# 构建生产版本
pnpm tauri build

# 运行生产构建
.\src-tauri\target\release\FreeReNamer.exe
```

在生产环境中：
1. 创建或编辑一个列表映射规则
2. 在文本编辑器中输入多行文本
3. 使用鼠标拖拽选中部分文字
4. **验证**: 选中的文字应该显示淡蓝色背景（rgba(173, 214, 255, 0.7)）

### 手动验证清单

- [ ] 单行文字选择有高亮
- [ ] 多行文字选择有高亮
- [ ] Ctrl+A全选有高亮
- [ ] 双击选中单词有高亮
- [ ] 多光标选择（Ctrl+Shift+点击）有高亮
- [ ] 选择后文字颜色保持清晰可读

## 调试工具

如果问题仍然存在，可以在生产环境中打开控制台（如果可用）并运行：

```javascript
// 检查选择样式
const editor = document.querySelector('.monaco-editor');
if (editor) {
  const styles = getComputedStyle(editor);
  console.log('Editor styles:', {
    selection: window.getComputedStyle(
      document.querySelector('.monaco-editor .selections-layer .selection')
    )?.backgroundColor
  });
}

// 检查是否应用了自定义样式
const styleSheets = Array.from(document.styleSheets);
const monacoRules = styleSheets.flatMap(sheet => 
  Array.from(sheet.cssRules || [])
).filter(rule => 
  rule.selectorText?.includes('monaco-editor') && 
  rule.selectorText?.includes('selection')
);
console.log('Monaco selection rules:', monacoRules);
```

## 相关文件

- `src/styles.css` - CSS修复
- `src/components/ui/text-editor.tsx` - TextEditor组件
- `src/components/rule/list-edit-dialog.tsx` - 使用TextEditor的对话框
- `src/components/rule/rule-map-secondary-edit-dialog.tsx` - 规则映射编辑对话框

## 已知限制

1. **颜色固定**: 当前选择高亮颜色为淡蓝色（rgba(173, 214, 255, 0.7)），不支持主题切换
2. **WebView差异**: 不同Windows版本的WebView2可能有细微的渲染差异
3. **性能影响**: 使用`!important`强制覆盖可能轻微影响样式计算性能（影响极小）

## 未来改进

1. **主题支持**: 支持根据应用主题动态调整选择高亮颜色
2. **用户自定义**: 允许用户在设置中自定义选择高亮颜色
3. **自动检测**: 在运行时检测WebView版本并应用相应的修复策略

## 参考资料

- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/index.html)
- [Tauri WebView配置](https://tauri.app/v1/guides/building/webview)
- [CSS ::selection伪元素](https://developer.mozilla.org/zh-CN/docs/Web/CSS/::selection)

