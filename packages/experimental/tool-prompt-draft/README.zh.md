---
description: "预设作用域的提示词草稿工具（get_prompt_draft、update_prompt_draft），基于宿主 ctx.promptDrafts 服务，供选择哪些 agent 可以打磨本会话生成提示词的部署使用。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-prompt-draft

[English](README.md) | 中文

## 概述

使用 `dsh-tool-prompt-draft`，可通过 `get_prompt_draft` 与 `update_prompt_draft` 让 agent（智能体）读取并重写当前会话的提示词草稿。这份草稿就是作者与 agent 一起打磨的文章生成提示词,它属于宿主 `@deepseek-ai/dsh-workbench` 的域,并以事件溯源的方式从 Session 日志派生。本包把两个工具注册进挂载它的 preset 或 Agent 作用域;由 preset 决定哪些 agent 获得它们。`tool:prompt-draft` system prompt 段落让当前草稿在每一轮里保持可见,于是「再短一点」落在作者刚读过的原文上。失败时返回一个结构化错误码。

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

当某个 preset 的 agent 需要打磨本会话的生成提示词时,把下面这一行加入该 preset 的插件列表。随产品发布的工作台 preset 会挂载它。

### 何时选用

当 preset 的 agent 需要针对作者持续修改的提示词写作文章时选用它,并在同一进程内加载 `@deepseek-ai/dsh-workbench`:本包只是该草稿域面向模型的消费方。省略该行的 preset 不暴露任何草稿工具,其 agent 在 system prompt 里也看不到草稿。

### 两个工具

- `get_prompt_draft()` —— 读取当前草稿。草稿尚不存在时返回 `null`;否则返回草稿的 `id`、`revision`、`title`、`body`、`createdAt` 与 `updatedAt`。`update_prompt_draft` 需要其中的 `id` 与 `revision`。
- `update_prompt_draft(title?, body?, draft_id?, revision?)` —— 创建或重写草稿。当前没有草稿时,省略 `draft_id` 与 `revision` 并给出 `body`;当前已有草稿时,给出 `get_prompt_draft` 返回的准确 `draft_id` 与 `revision`,以及要替换的字段。过期或不对的 `draft_id`、`revision` 会被拒绝,因此两个 agent 不会彼此无声覆盖。

### 最小配置

```yaml
- name: '@deepseek-ai/dsh-tool-prompt-draft'
```

本包不声明任何 `Config` 字段。它注入 `ctx.agents`、`ctx.promptDrafts`、`ctx.tools` 与 `ctx.systemPrompt`,并在作用域解析到宿主 `ctx.promptDrafts` 服务后注册这两个工具与共享的草稿段落,因此保持该服务关闭的组合不会挂载任何草稿工具。每次调用都代表派发该调用的 Agent 执行。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

插件在解析到 `ctx.promptDrafts` 的作用域内注册两个 `defineTool` 定义与一个 `tool:prompt-draft` system prompt 段落,因此由 preset 挂载决定可见性,并由 Cordis effect 的所有权随挂载一并释放。该段落渲染组装中 Session 的当前草稿,在没有当前草稿时为空。执行时读取 `exec.agent` 作为执行操作的 Session,并检查该 Agent 是注册表中的活动实例、处于运行中、且是当前 initiator;未通过检查的调用抛出 `DRAFT_TOOL_AGENT_REQUIRED`,而不会猜测某个 Session。参数校验在服务调用之前完成:新建草稿必须有正文且拒绝携带 `draft_id` 或 `revision`,已有草稿则必须同时给出 `draft_id` 与 `revision`。模型内容为返回值的规范 JSON,而持久化的修订历史由宿主服务负责。

### 源码映射

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口:两个工具、共享的草稿段落、输出 schema,以及 render/present 辅助函数 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [Workbench 包](../workbench/README.zh.md) —— 这些工具所读取的宿主草稿域、文章库与 `/draft` 命令。
- [Experimental 分组映射](../README.zh.md) —— 本组内的同级包。

-----

<a id="model-experience"></a>
## 模型体验

### 共享 system prompt

#### What the model sees

只要本包在调用方 Agent 的作用域内可见,每次组装 prompt 都会加入一个 `tool:prompt-draft` 段落。该段落在 `<prompt_draft>` 标签之间带上草稿的 id、revision、title 与正文,没有当前草稿时为空。`complete: true` 的 system prompt 覆盖会替换普通段落,本段落也包括在内。

##### 草稿小节的形状

```markdown
<prompt_draft>
id: <draft id>
revision: <draft revision>
title: <draft title>

<draft body>
</prompt_draft>
```

#### Token effect

该段落在每次组装 prompt 时重复整份草稿正文,因此较长的草稿每轮都要付出全文的长度。不挂载本包的作用域不承担这份开销。

#### KV Cache effect

草稿一变,段落文本随之变化,从第一个变化的草稿 token 起复用即失效。草稿保持稳定时前缀保持稳定。

### 工具 schema

#### What the model sees

只要本包在调用方 Agent 的作用域内可见,模型就会收到生成的 [`get_prompt_draft` 与 `update_prompt_draft` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-prompt-draft)。`update_prompt_draft` 声明可选的 `draft_id`、`revision`、`title` 与 `body` 参数;参数说明写明 id 与 revision 来自 `get_prompt_draft`。

#### Token effect

凡是 preset 挂载了本包的 Agent,其每次请求都有固定的 schema 开销。省略该行的 preset 下的 Agent 不付出任何开销。

#### KV Cache effect

只要工具定义与可见性不变,前缀保持稳定。挂载、释放或作用域变化都可能使从首个变化 schema token 起的复用失效。

### 草稿结果

#### What the model sees

每次调用返回一个规范 JSON 文本块。`get_prompt_draft` 在没有草稿时返回 `{ draft: null }`,否则返回 `{ draft: { id, revision, title, body, createdAt, updatedAt } }`。`update_prompt_draft` 对新建或更新后的草稿返回同样的结构。被拒绝的调用返回结构化错误:工具自身的 `DRAFT_TOOL_AGENT_REQUIRED` 或 `DRAFT_TOOL_INVALID_UPDATE`,或者当所指修订号已不是当前修订号时由域返回的 `DRAFT_STALE_REVISION`。

#### Token effect

结果会留在调用方 Session 的历史中直到压缩,且每次读取都重复整份草稿正文,于是正文在之后的每次请求中都要再次付出。

#### KV Cache effect

只追加;新可见内容跟在可复用的请求前缀之后,不会使既有 KV Cache 条目失效。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **没有宿主服务就没有工具** —— 在缺少 `ctx.promptDrafts` 的组合中挂载本包会让插件保持挂起,两个工具都不会注册。
- **每次调用都需要活动的调用方 Agent** —— 未携带注册表中活动运行 initiator 的调用抛出 `DRAFT_TOOL_AGENT_REQUIRED`,而不会猜测某个 Session。
- **每个 Session 只有一份草稿** —— 该域保存一份当前草稿及其修订历史;第二个并发写入者会被比较并设置检查拒绝,而不是被无声覆盖。
- **草稿正文会被完整重复** —— 段落与每次读取结果都带上完整正文,因此较长的草稿每轮都要付出全文长度;本包不做截断。
- **草稿状态归宿主负责** —— 这些工具不提供时钟、存储与自己的修订策略;这些限制属于该服务。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

None.

</details>
