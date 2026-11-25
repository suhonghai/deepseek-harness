---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-25-prompt-draft-event

English | [中文](2026-11-25-prompt-draft-event.zh.md)

## Summary

Adds the `prompt-draft/change` session event, which records one prompt-draft mutation.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

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
## Compatibility

Existing records remain valid. The new event is its own root, so a reader that does not know it skips it as it skips any other unknown event type, and a reader that does know it reconstructs the draft from the event's own fields. The payload carries only the content that changed plus the revision it advances from and the revision it produces, so a title-only edit never copies the body into the log again.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/experimental/workbench/tests/ — 19 tests passed. pnpm exec vitest run --config vitest.e2e.config.ts packages/experimental/workbench/tests/draft.e2e.ts — 1 test passed.

<a id="dev-note"></a>
## Dev Note

None.
