---
description: "内容生产的工作台 bundle:创作者工作的那块面板、agent 与作者一起打磨的提示词草稿,以及构成这个产品的四块面 —— 生成提示词、文章、素材、发布。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-workbench

[English](README.md) | 中文

## 概述

Web 客户端的内容生产工作台 bundle。它贡献一个全局面板 —— 创作者工作的那块工作台 —— 以及构成这个产品的四块面:作者与 agent 一起打磨的生成提示词、文章库、素材库、发布队列。生成提示词与文章库接了真实数据,素材与发布仍是占位。

提示词草稿是这个 bundle 的宿主能力。一个会话一份草稿,持久在会话日志里,带一个模型和用户互相校对的修订号。

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

这个 bundle 给 Web 客户端的**会话右侧栏**加一个 tab。引导页出现「工作台」卡片,点它就在会话旁边打开工作台;不想看时收起分栏,聊天仍是全宽。面板列出这个产品的四块面:生成提示词、文章、素材、发布。生成提示词区读的是**当前会话**的草稿 —— tab 的座位是会话级的,所以它显示的就是这一轮对话的草稿,不再需要在所有会话里挑最新的那份 —— 并渲染正文、修订号、保留的版本数和一个「继续在对话里打磨」按钮;文章区从文章库读出成稿列表,按更新时间倒序列出草稿、待发布、已发布三种状态。素材与发布仍然渲染「尚未实现」标记。

提示词草稿按产品需要的方式工作。你跟 agent 说话,双方一起改同一份文章生成提示词。草稿是会话范围内的状态:agent 用 `get_prompt_draft` 读它、用 `update_prompt_draft` 改写它,你用 `/draft` 命令读它 —— 单独 `/draft` 显示当前文本,`/draft <正文>` 替换正文,`/draft clear` 清空。每次修订都带一个号,bundle 保留被取代的修订,所以你能看到提示词是怎么演变成现在这样的。

草稿不是一条旁路:它的正文出现在每一轮对话的系统提示词里,所以「再短一点」落在你刚读过的那份原文上,而不是它的摘要上。

聊天本身不属于这个 bundle。会话保持它启动时的 Agent 预设,所以以标准模式开始的会话继续用标准模式的工具集。

安装这个 bundle 就是让面板出现在界面上、草稿进到会话里。它声明了 `dsh.bundle.patch`,所以把 `@deepseek-ai/dsh-workbench` 加进 profile 的 `dsh.profile.bundles` 就是完整的安装步骤;浏览器半从声明客户端依赖的同一份 manifest 懒加载。

<a id="understand-the-implementation"></a>
## 理解实现

这个包有两面。宿主面(`src/index.ts`)装载文章库、提示词草稿域和 `/draft` 命令。浏览器面(`src/client/`)把工作台注册成右侧栏的一个 tab:先在 `ctx.sidebarRightTabs` 声明 tab 类型,再以同一个 id 把 body 注册到 `sidebar.right.pane.tab` —— 与官方「计划预览」「变更审阅」页走的是同一种两段式注册。该座位是会话级的,所以 body 直接用 `useProjection` 读当前会话的草稿,不需要额外的 API。浏览器半在 `apply` 里挂载本包的 `remote` 契约,拿到 `articles` Remote 命名空间,并挂载后卸载对称清理。

宿主面在 `src/host/` 下按职责一个文件一个文件地拆开。`article-domain.ts` 放文章域声明、记录 schema 和 Remote 边界类型;`article-service.ts` 拥有 `ctx.articles` 服务(base bundle 的 storage-domain / json 后端)。`types.ts` 聚合两个域的纯类型,是包 `./types` 子路径的落点。`draft-types.ts` 放纯类型和 `promptDraft` 投影键声明,不含宿主导入,浏览器半因此能投影同一份内容。`draft-domain.ts` 放持久变更载荷和 `prompt-draft/change` 会话事件。`draft-fold.ts` 是纯回放折叠与它的严格解码器。`draft-runtime.ts` 放错误码与变更版本。`draft-service.ts` 拥有 `ctx.promptDrafts` 服务,`draft-command.ts` 拥有面向用户的入口。面向模型的两块面各自独立成包 —— `@deepseek-ai/dsh-tool-prompt-draft` 与 `@deepseek-ai/dsh-tool-articles` —— 因为工具注册发生在挂载它的 Agent 作用域内,由工作台 preset 决定哪些 agent 获得它们。

面板的数据有两条来源:草稿走 `promptDraft` 会话投影(Control Stream 实时推送,用全局 `useSessions` hook 读所有会话的投影值,挑出最近更新的那份),文章走 `articles` Remote(`articles-store.ts` 在挂载时读一次,连接重置时重读)。面板是全局面板,不绑定单个会话。

这个域是事件溯源的。会话事件 `prompt-draft/change` 记录每一次变更:创建带初始内容,更新只带发生变化的内容加上它推进自哪个修订、推进到哪个修订,清空带一个墓碑。会话投影把这些事件合成当前整份草稿和保留下来的修订历史。因为更新只带变化的部分,只改标题不会把正文再抄一遍进日志。

变更是比较并交换式的:更新要写明它读到的是哪个修订,陈旧的修订会被拒绝而不是覆盖到更新的修订上。服务还会拒绝任何不是注册表持有的那个确切活跃 agent 的调用方,所以一个会话改不了另一个会话的草稿。

面板内容是一个普通 React 组件,props 来自 slot 渲染器:`PropsRuntime<'main'>` 给出运行时部分,`PropsLocale<'workbench'>` 给出文案。文案放在 `src/client/locales.ts`,以 `workbench` 命名空间在全部八种已发布语言里注册。

<a id="further-exploration"></a>
## 进一步探索

- `packages/client/ui-layout` —— `main` slot 与切换主区域的 `selectPanel`
- `packages/client/ui-sidebar-right` —— 会话右侧栏:tab 座位、引导页与收起控制
- `packages/client/ui-plan` —— 以同样方式注册右侧栏 tab 的官方页面
- `packages/preset/agent-preset-registry` —— 会话运行的 Agent 预设
- `packages/goal/goal` —— 同一种会话内事件溯源域的形状,只是 goal 另有草稿不需要的续跑生命周期

<a id="dev-note"></a>
## 开发备注

这个 bundle 从 profile 的 `node_modules` 里解析包名,因为 bundle 名先从 dsh 安装目录解析、再从 profile 目录解析。不携带这个包的 profile 因此什么都解析不到,失败也是静默的 —— 没有行,没有日志。`scripts/dev-setup.sh` 正是为此把工作区包链进 profile 目录;从 npm 安装的 profile 则从自己的依赖树里拿到这个包。

这个域刻意没有阶段机、没有激活状态、也没有任何进程内字段。读者能观察到的每个事实都出自会话日志,所以恢复出来的会话看到的草稿和活跃会话一样。保留的修订历史是部署选择,不是协议常量:服务配置上的 `maxVersions` 限定投影保留多少个被取代的修订,默认是二十。

草稿正文通过一个 text 是「按会话求值函数」的小节渲染进系统提示词,所以提示词里带的是发起请求那个会话的文本,而不是别的会话的。

<a id="model-experience"></a>
## 模型体验

### 工作台面板

#### 模型看到什么

面板本身不贡献任何东西。面板是浏览器侧的视图:浏览器半为 `sidebar.right.pane.tab` 座位调用 `ctx.sidebarRightTabs.register` 与 `ctx.slots.register`,面板不贡献工具、不贡献提示词小节、也不贡献会话事件。

#### Token 影响

无。面板不加请求载荷、不加系统提示词、也不加工具 schema。

#### KV 缓存影响

不变。面板不给任何模型请求加前缀,所以请求缓存的行为与没有它时完全一致。

### 面向模型的工具

#### 模型看到什么

这个包自身什么都不提供。工作台宿主面不注册任何工具、提示词小节或模型可见事件;草稿正文与文章库只通过工作台 preset 挂载的两个工具包到达模型 —— `@deepseek-ai/dsh-tool-prompt-draft` 与 `@deepseek-ai/dsh-tool-articles`。这两个包各自拥有提示词小节与工具 schema,并各自记录模型接收到的内容。

#### Token 影响

自身没有开销。草稿小节与五个工具 schema 的 token 开销归这两个工具包;省略那两行的 preset 一分也不付。

#### KV 缓存影响

不变。工作台不给任何模型请求加前缀;草稿小节与工具 schema 的缓存效果归这两个工具包。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓事项

- 素材库、发布队列仍然是占位。生成提示词与文章库接了真实数据。
- 面板只读文章库,不提供文章的编辑、发布状态流转或删除界面。模型通过 `save_article` 写入与修订;面向人的编辑界面留到后续版本。
- 面板展示的是「最近更新的那份草稿」。一个会话一份草稿,跨多个会话时取 `updatedAt` 最大的那份;第二份草稿的选择规则这一版还没有。
- 文章列表在挂载与连接重置时读取,没有针对模型写入文章后的实时推送订阅;当次会话内的即时刷新仍需重连或重载面板。
