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

这个 bundle 给 Web 客户端加一个全局面板。左侧栏出现「工作台」入口,点它把主区域切到工作台面板,点回会话入口则回到聊天。面板列出这个产品的四块面:生成提示词、文章、素材、发布。生成提示词区显示最近更新的那份草稿正文、修订号和一个「继续在对话里打磨」按钮(点它回到产出该草稿的会话);文章区从文章库读出成稿列表,按更新时间倒序列出草稿、待发布、已发布三种状态。素材与发布仍然渲染「尚未实现」标记。

提示词草稿按产品需要的方式工作。你跟 agent 说话,双方一起改同一份文章生成提示词。草稿是会话范围内的状态:agent 用 `get_prompt_draft` 读它、用 `update_prompt_draft` 改写它,你用 `/draft` 命令读它 —— 单独 `/draft` 显示当前文本,`/draft <正文>` 替换正文,`/draft clear` 清空。每次修订都带一个号,bundle 保留被取代的修订,所以你能看到提示词是怎么演变成现在这样的。

草稿不是一条旁路:它的正文出现在每一轮对话的系统提示词里,所以「再短一点」落在你刚读过的那份原文上,而不是它的摘要上。

聊天本身不属于这个 bundle。会话保持它启动时的 Agent 预设,所以以标准模式开始的会话继续用标准模式的工具集。

安装这个 bundle 就是让面板出现在界面上、草稿进到会话里。它声明了 `dsh.bundle.patch`,所以把 `@deepseek-ai/dsh-workbench` 加进 profile 的 `dsh.profile.bundles` 就是完整的安装步骤;浏览器半从声明客户端依赖的同一份 manifest 懒加载。

<a id="understand-the-implementation"></a>
## 理解实现

这个包有两面。宿主面(`src/index.ts`)装载文章库、提示词草稿域、它们的模型工具和 `/draft` 命令。浏览器面(`src/client/`)把面板注册到布局服务的 `main` keyed slot、把侧栏入口注册到 `sidebar.panellist` list slot,与官方插件管理页走的是同两个 slot。按钮、标签和选中态由侧栏负责,面板只提供内容。浏览器半在 `apply` 里挂载本包的 `remote` 契约,拿到 `articles` Remote 命名空间,并挂载后卸载对称清理。

宿主面在 `src/host/` 下按职责一个文件一个文件地拆开。`article-domain.ts` 放文章域声明、记录 schema 和 Remote 边界类型;`article-service.ts` 拥有 `ctx.articles` 服务(base bundle 的 storage-domain / json 后端);`article-tools.ts` 是面向模型的 `list_articles` / `get_article`。`types.ts` 聚合两个域的纯类型,是包 `./types` 子路径的落点。`draft-types.ts` 放纯类型和 `promptDraft` 投影键声明,不含宿主导入,浏览器半因此能投影同一份内容。`draft-domain.ts` 放持久变更载荷和 `prompt-draft/change` 会话事件。`draft-fold.ts` 是纯回放折叠与它的严格解码器。`draft-runtime.ts` 放错误码与变更版本。`draft-service.ts` 拥有 `ctx.promptDrafts` 服务,`draft-tools.ts` 和 `draft-command.ts` 分别拥有面向模型和面向用户的入口。

面板的数据有两条来源:草稿走 `promptDraft` 会话投影(Control Stream 实时推送,用全局 `useSessions` hook 读所有会话的投影值,挑出最近更新的那份),文章走 `articles` Remote(`articles-store.ts` 在挂载时读一次,连接重置时重读)。面板是全局面板,不绑定单个会话。

这个域是事件溯源的。会话事件 `prompt-draft/change` 记录每一次变更:创建带初始内容,更新只带发生变化的内容加上它推进自哪个修订、推进到哪个修订,清空带一个墓碑。会话投影把这些事件合成当前整份草稿和保留下来的修订历史。因为更新只带变化的部分,只改标题不会把正文再抄一遍进日志。

变更是比较并交换式的:更新要写明它读到的是哪个修订,陈旧的修订会被拒绝而不是覆盖到更新的修订上。服务还会拒绝任何不是注册表持有的那个确切活跃 agent 的调用方,所以一个会话改不了另一个会话的草稿。

面板内容是一个普通 React 组件,props 来自 slot 渲染器:`PropsRuntime<'main'>` 给出运行时部分,`PropsLocale<'workbench'>` 给出文案。文案放在 `src/client/locales.ts`,以 `workbench` 命名空间在全部八种已发布语言里注册。

<a id="further-exploration"></a>
## 进一步探索

- `packages/client/ui-layout` —— `main` slot 与切换主区域的 `selectPanel`
- `packages/client/ui-sidebar` —— 侧栏渲染的面板列表
- `packages/client/ui-plugin-manager` —— 以同样方式注册 `main` 面板的官方页面
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

面板本身不贡献任何东西。面板是浏览器侧的视图:浏览器半为 `main` 与 `sidebar.panellist` 两个 slot 调用 `ctx.slots.register`,面板不贡献工具、不贡献提示词小节、也不贡献会话事件。

#### Token 影响

无。面板不加请求载荷、不加系统提示词、也不加工具 schema。

#### KV 缓存影响

不变。面板不给任何模型请求加前缀,所以请求缓存的行为与没有它时完全一致。

### 提示词草稿

#### 模型看到什么

每一轮都是草稿自己的文本。一个提示词小节渲染当前草稿的 id、修订号、标题和正文;正文是作者写的文字,属于这个包透传的数据,不是它自己拥有的文案。

##### 提示词小节的形状

```markdown
<prompt_draft>
id: <draft id>
revision: <draft revision>
title: <draft title>

<draft body>
</prompt_draft>
```

#### Token 影响

草稿存在期间,草稿正文会被加进每次请求的系统提示词,开销因此跟着草稿长度走,而不是跟着编辑次数走。没有草稿时这个小节不贡献任何内容。

#### KV 缓存影响

小节之前的前缀是稳定的;这个小节排在 2450,位于工具策略之后。一次草稿编辑替换掉小节的文本,因此从该处起让缓存失效,而不是从系统提示词开头起。

### 草稿工具

#### 模型看到什么

两个工具。`get_prompt_draft` 返回当前草稿,连同 `update_prompt_draft` 需要的 id 和修订号;`update_prompt_draft` 替换标题、正文或两者,并把修订号推进一号。陈旧的修订号在执行时被拒绝。作者的话需要改写时,模型随时可以改写草稿;不要求作者先说过话。

#### Token 影响

每次请求带上两个工具定义,每次调用再带上一个紧凑的 JSON 结果。

#### KV 缓存影响

工具定义不变时前缀稳定。调用与结果追加在可复用的请求前缀之后,不会让更早的条目失效。

### 文章库工具

#### 模型看到什么

面向持久文章库的两个只读工具:`list_articles` 返回已存文章的 id、标题、状态、更新时间和正文摘要(可按状态过滤),`get_article` 按 id 读取一整篇正文。文章库本身不注入提示词,模型只看到这两个工具返回的内容。排在 2460 的一个提示词小节告诉模型这个库存在。

#### Token 影响

每次请求多带两个工具定义,每次调用再带一个 JSON 结果。文章正文只在 `get_article` 的结果里进入请求,所以开销跟着模型实际读到的内容走,而不是跟着库的大小走。

#### KV 缓存影响

工具定义稳定,到它们为止的请求前缀可以复用。文章库引导小节排在 2460;调用与结果追加在可复用前缀之后,不会让更早的条目失效。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓事项

- 素材库、发布队列仍然是占位。生成提示词与文章库接了真实数据。
- 面板只读文章库,不提供文章的编辑、发布状态流转或删除界面 —— 这些操作目前由模型工具与后续版本补上。
- 面板展示的是「最近更新的那份草稿」。一个会话一份草稿,跨多个会话时取 `updatedAt` 最大的那份;第二份草稿的选择规则这一版还没有。
- 文章列表在挂载与连接重置时读取,没有针对模型写入文章后的实时推送订阅;当次会话内的即时刷新仍需重连或重载面板。
