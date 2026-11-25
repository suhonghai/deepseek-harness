---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-25-prompt-draft-event

[English](2026-11-25-prompt-draft-event.md) | 中文

## 概述

新增 `prompt-draft/change` 会话事件,记录一次提示词草稿变更。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-11-25-prompt-draft-event
baseline: false
changes:
  - root: "event:prompt-draft/change"
    previous: null
    after: "feffe9b40e3fe94bd0aacfb4dbd998e9f96d8b6cb022f9926e28d635eacd59c4"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

已有记录仍然有效。新事件是独立的一个 root,不认识它的读者像跳过任何其他未知事件类型一样跳过它;认识它的读者按事件自带的字段重建草稿。载荷只带发生变化的内容,加上它推进自哪个修订、推进到哪个修订,所以只改标题不会把正文再抄进日志。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/experimental/workbench/tests/ —— 19 个测试通过。pnpm exec vitest run --config vitest.e2e.config.ts packages/experimental/workbench/tests/draft.e2e.ts —— 1 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
