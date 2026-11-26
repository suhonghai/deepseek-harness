---
description: "预设作用域的文章库工具（list_articles、get_article、save_article），基于宿主 ctx.articles 服务，供选择哪些 agent 可以读写共享文章库的部署使用。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-articles

[English](README.md) | 中文

## 概述

使用 `dsh-tool-articles`，可通过 `list_articles`、`get_article` 与 `save_article` 让 agent（智能体）列出、读取并保存工作台文章库里的成稿。文章库是这个 profile 下所有会话共用的持久存储,它属于宿主 `@deepseek-ai/dsh-workbench` 包,其记录不进入 Session 日志。本包把三个工具注册进挂载它的 preset 或 Agent 作用域;由 preset 决定哪些 agent 获得它们。`tool:articles` system prompt 段落告诉模型文章库的存在。失败时返回一个结构化错误码。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

当某个 preset 的 agent 需要读写共享的文章库时,把下面这一行加入该 preset 的插件列表。随产品发布的工作台 preset 会挂载它。

### 何时选用

当 preset 的 agent 需要发布成稿时选用它,并在同一进程内加载 `@deepseek-ai/dsh-workbench`:本包只是该文章库面向模型的消费方。省略该行的 preset 不暴露任何文章工具,其 agent 在 system prompt 里也看不到文章库的指导。

### 三个工具

- `list_articles(status?)` —— 列出已存的文章,按最近更新时间在前。`status` 只保留 `draft`、`ready` 或 `published` 状态的文章;省略则列出全部。每行带有文章的 `id`、`title`、`sessionId`、`status`、`updatedAt` 与一小段正文摘要。
- `get_article(article_id)` —— 按 `list_articles` 返回的 id 读取一篇已存文章。结果带有完整正文;id 未知时返回 `null`。
- `save_article(title, body, sessionId, id?, status?)` —— 把成稿存进文章库,或修订库里已有的一篇。给出已有文章的 `id` 即替换它,省略 id 则存入新的一篇。文章库由每个会话共享,`sessionId` 记录这篇内容出自哪个会话。

### 最小配置

```yaml
- name: '@deepseek-ai/dsh-tool-articles'
```

本包不声明任何 `Config` 字段。它注入 `ctx.articles`、`ctx.tools` 与 `ctx.systemPrompt`,并在作用域解析到宿主 `ctx.articles` 服务后注册这三个工具与共享的文章库段落,因此保持该服务关闭的组合不会挂载任何文章工具。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

插件在解析到 `ctx.articles` 的作用域内注册三个 `defineTool` 定义与一个 `tool:articles` system prompt 段落,因此由 preset 挂载决定可见性,并由 Cordis effect 的所有权随挂载一并释放。该段落点明文章库的存在与模型可做的三次调用。读取这一对工具会等待宿主服务,因此仍在打开中的文章库会推迟结果而不是失败。列表把每篇正文压成空白折叠后的摘要,长度至多 200 个字符;读取工具返回完整正文。写入工具把模型的字段交给宿主服务,由后者掌管身份、时间戳与默认的 `draft` 状态。模型内容为返回值的规范 JSON。

### 源码映射

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口:三个工具、共享的文章库段落、输出 schema,以及 render/present 辅助函数 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [Workbench 包](../workbench/README.zh.md) —— 宿主文章库,以及读取同一批记录的浏览器面板。
- [Experimental 分组映射](../README.zh.md) —— 本组内的同级包。

-----

<a id="model-experience"></a>
## 模型体验

### 共享 system prompt

#### What the model sees

只要本包在调用方 Agent 的作用域内可见,每次组装 prompt 都会加入一个 `tool:articles` 段落。它点明这个共享文章库,以及模型可做的三次调用。`complete: true` 的 system prompt 覆盖会替换普通段落,本段落也包括在内。

##### 文章库小节的形状

```markdown
<article_library>
The workbench keeps saved articles in a durable library that every conversation shares.
Call list_articles to see which articles exist, and get_article with an article id to read one.
Call save_article to store a finished piece in the library; pass the id of an existing article to revise it.
</article_library>
```

#### Token effect

每次组装 prompt 增加一段固定文本。不挂载本包的作用域不承担这份开销。

#### KV Cache effect

段落文本与工具可见性不变时,前缀保持稳定。挂载、释放或过滤都可能使从该段落起的复用失效。

### 工具 schema

#### What the model sees

只要本包在调用方 Agent 的作用域内可见,模型就会收到生成的 [`list_articles`、`get_article` 与 `save_article` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-articles)。`save_article` 把 `title`、`body` 与 `sessionId` 声明为必填,`id` 与 `status` 声明为可选;`get_article` 声明必填的 `article_id`。

#### Token effect

凡是 preset 挂载了本包的 Agent,其每次请求都有固定的 schema 开销。省略该行的 preset 下的 Agent 不付出任何开销。

#### KV Cache effect

只要工具定义与可见性不变,前缀保持稳定。挂载、释放或作用域变化都可能使从首个变化 schema token 起的复用失效。

### 文章结果

#### What the model sees

每次调用返回一个规范 JSON 文本块。`list_articles` 返回 `{ articles: [...] }`,每篇文章带有 id、title、session id、status、更新时间与摘要。`get_article` 对未知 id 返回 `{ article: null }`,否则返回带完整正文与两个时间戳的文章。`save_article` 返回文章库当前持有的那篇文章,包含宿主服务所赋予的身份与时间戳。

#### Token effect

结果会留在调用方 Session 的历史中直到压缩;一次列表为每篇文章付出一段摘要,一次读取则在之后的每次请求中付出完整正文。

#### KV Cache effect

只追加;新可见内容跟在可复用的请求前缀之后,不会使既有 KV Cache 条目失效。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **没有宿主服务就没有工具** —— 在缺少 `ctx.articles` 的组合中挂载本包会让插件保持挂起,三个工具都不会注册。
- **每个工具都能触及全部已存文章** —— 文章库由这个 profile 下的每个会话共享,模型可以读取并修订其他会话写下的内容。宿主不做按 Session 的归属检查。
- **列表会截断正文** —— `list_articles` 每篇最多返回 200 个字符;读取全文需要另外一次 `get_article` 调用。
- **写入工具不能删除** —— 本包只负责存入与修订文章;删除归宿主 `ctx.articles` 服务所有,由浏览器面板暴露。
- **文章状态归宿主负责** —— 这些工具不提供时钟、存储与自己的发布策略;这些限制属于该服务。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

None.

</details>
