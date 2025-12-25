# 项目 上下文

## 目的
FreeReNamer 是一个功能强大、易用的文件批量重命名工具，提供网页版与桌面端，支持拖拽导入、规则化批量改名与脚本扩展。

## 技术栈
- TypeScript、React 18
- Vite 5 构建与开发
- Tailwind CSS + Radix UI 组件
- TanStack Router / React Query、Jotai 状态管理
- Tauri（Rust）桌面端封装
- Monaco Editor 脚本编辑器
- pnpm 作为包管理器

## 项目约定

### 代码风格
使用 Biome 进行格式化与 lint：2 空格缩进、单引号；启用导入整理；Tailwind 类名排序警告。
仓库内存在 Prettier 配置（单引号 + Tailwind 插件），如使用需与 Biome 保持一致。

### 架构模式
前端采用 React 组件化架构，路由使用 TanStack Router；数据与异步请求使用 React Query，状态管理使用 Jotai。
通过环境变量区分 web/tauri 构建（PLATFORM=web 或 tauri），桌面端逻辑位于 src-tauri。

### 测试策略
当前未看到测试脚本或测试框架配置（package.json 无 test）。如需补充测试策略可再行定义。

### Git工作流
提交规范采用 Conventional Commits：
- 格式：type(scope): subject
- type 取值：feat、fix、docs、style、refactor、test、chore、build、ci、perf、revert
- scope 可选，建议使用模块/目录名（如 ui、router、tauri）
- subject 使用中文动词开头，简短描述改动
- 需要破坏性变更时在正文添加 BREAKING CHANGE

## 领域上下文
核心领域为文件批量重命名：支持拖拽文件/文件夹、多个配置与规则、JS 脚本规则（内置 Monaco）。
网页版依赖浏览器文件系统接口，桌面端使用原生能力。

## 重要约束
网页端依赖 File System Access API 的 move 能力，兼容性受限（推荐新版 Chrome）；网页端会触发浏览器权限确认。
配置存储：网页端使用 IndexedDB，桌面端使用文件存储。

## 外部依赖
Tauri 运行时与 tauri-plugin-store（桌面端存储）。
浏览器 File System Access API（网页端文件操作）。
