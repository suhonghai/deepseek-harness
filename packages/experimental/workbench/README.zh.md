---
description: "内容生产的工作台 bundle:创作者工作的那块面板,以及构成这个产品的四块面 —— 生成提示词、文章、素材、发布。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-workbench

[English](README.md) | 中文

## 概述

Web 客户端的内容生产工作台 bundle。它贡献一个全局面板 —— 创作者工作的那块工作台 —— 以及构成这个产品的四块面:作者与 agent 一起打磨的生成提示词、文章库、素材库、发布队列。这一版里,面板是这些面将要落脚的框架,它们本身还是占位。

## 目录

- [使用这个包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [开发备注](#dev-note)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用这个包

这个 bundle 给 Web 客户端加一个全局面板。左侧栏出现「工作台」入口,点它把主区域切到工作台面板,点回会话入口则回到聊天。面板列出这个产品的四块面:生成提示词、文章、素材、发布。每一块都渲染标题、一句话用途和「尚未实现」标记。

聊天本身不属于这个 bundle。会话保持它启动时的 Agent 预设,所以以标准模式开始的会话继续用标准模式的工具集。这个 bundle 要补的是对话在改的那份提示词草稿:一个会话范围内的状态,agent 在对话中读写它,以及一个展示当前文本与修订历史的视图。

安装这个 bundle 就是让面板出现在界面上。它声明了 `dsh.bundle.patch`,所以把 `@deepseek-ai/dsh-workbench` 加进 profile 的 `dsh.profile.bundles` 就是完整的安装步骤;浏览器半从声明客户端依赖的同一份 manifest 懒加载。

<a id="understand-the-implementation"></a>
## 理解实现

这个包有两面。宿主面(`src/index.ts`)是一个空的插件体 —— 它唯一的作用是给这个包一个 Loader 行,没有它浏览器半不会被装载。浏览器面(`src/client/`)把面板注册到布局服务的 `main` keyed slot、把侧栏入口注册到 `sidebar.panellist` list slot,与官方插件管理页走的是同两个 slot。按钮、标签和选中态由侧栏负责,面板只提供内容。

面板内容是一个普通 React 组件,props 来自 slot 渲染器:`PropsRuntime<'main'>` 给出运行时部分,`PropsLocale<'workbench'>` 给出文案。文案放在 `src/client/locales.ts`,以 `workbench` 命名空间在全部八种已发布语言里注册。

<a id="further-exploration"></a>
## 进一步探索

- `packages/client/ui-layout` —— `main` slot 与切换主区域的 `selectPanel`
- `packages/client/ui-sidebar` —— 侧栏渲染的面板列表
- `packages/client/ui-plugin-manager` —— 用同样方式注册 `main` 面板的官方页面
- `packages/preset/agent-preset-registry` —— 会话运行时使用的 Agent 预设

<a id="dev-note"></a>
## 开发备注

这个 bundle 的包名从 profile 的 `node_modules` 解析,因为 bundle 名的解析先从 dsh installation、再从 profile 目录。不携带这个包的 profile 因此什么都解析不到,而且失败是静默的 —— 没有行,没有日志。`scripts/dev-setup.sh` 正因为这个把工作区包软链进 profile 目录;从 npm 安装的 profile 则由自己的依赖树提供这个包。

<a id="model-experience"></a>
## 模型体验

### 工作台面板

#### 模型看到什么

什么都没有。面板是纯客户端视图,宿主面没有注册工具、提示词段或会话事件。安装这个 bundle 不会改变任何会话的模型可见输入。

#### Token 影响

无。请求体、系统提示词与工具 schema 都不变。

#### KV 缓存影响

不变。这个 bundle 不给任何模型请求加前缀,请求缓存行为与没有它时完全一致。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓事项

- 四块面板面都是占位。提示词草稿、文章列表、素材库、发布队列都还没实现。
- 包还没有宿主侧能力,agent 无可读可写。提示词草稿域是宿主面的第一件事。
- 面板还没有接上文章数据。这些数据是放在 Harness 的会话存储里,还是放在产品自己的数据库里,尚未决定。
