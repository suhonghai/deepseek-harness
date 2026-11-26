---
description: "Preset-scoped prompt-draft tools (get_prompt_draft, update_prompt_draft) over the Host ctx.promptDrafts service, for deployments choosing which agents may refine the session's generation prompt."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-prompt-draft

English | [中文](README.zh.md)

## Summary

Use `dsh-tool-prompt-draft` to let an agent read and rewrite the current session's prompt draft through `get_prompt_draft` and `update_prompt_draft`. The draft is the article-generation prompt the author and the agent refine together; it belongs to the Host `@deepseek-ai/dsh-workbench` domain and is event-sourced from the Session log. The package registers the two tools in the preset or Agent scope that mounts it, so a preset decides which agents receive them. A `tool:prompt-draft` system-prompt section keeps the current draft visible in every turn, so a follow-up instruction lands on the text the author just read. Failures return one structured error code.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Add the row below to a preset's plugin list when that preset's agents should refine the session's generation prompt. The shipped workbench preset mounts it.

### When to choose it

Choose it for any preset whose agents write articles against a prompt the author keeps changing, and load `@deepseek-ai/dsh-workbench` in the same process: this package is only the model-facing consumer of that draft domain. A preset that omits the row exposes no draft tool, and its agents see no draft in the system prompt.

### The two tools

- `get_prompt_draft()` — Read the current draft. Returns `null` when no draft exists yet; otherwise the draft's `id`, `revision`, `title`, `body`, `createdAt`, and `updatedAt`. The `id` and `revision` are what `update_prompt_draft` requires.
- `update_prompt_draft(title?, body?, draft_id?, revision?)` — Create or rewrite the draft. With no current draft, omit `draft_id` and `revision` and pass a `body`; with a current draft, pass the exact `draft_id` and `revision` that `get_prompt_draft` returned, plus the fields to replace. A stale `draft_id` or `revision` is refused, so two agents cannot silently overwrite each other.

### Minimal configuration

```yaml
- name: '@deepseek-ai/dsh-tool-prompt-draft'
```

The package declares no `Config` fields. It injects `ctx.agents`, `ctx.promptDrafts`, `ctx.tools`, and `ctx.systemPrompt` and registers the two tools and the shared draft section once that scope resolves the Host `ctx.promptDrafts` service, so a composition that keeps that service off mounts no draft tool. Each call acts for the Agent that dispatched it.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin registers two `defineTool` definitions and one `tool:prompt-draft` system-prompt section in the scope that resolves `ctx.promptDrafts`, so a preset mount decides visibility and Cordis effect ownership disposes them with the mount. The section renders the current draft of the assembling Session and is empty while no draft is current. Execution reads `exec.agent` for the acting Session and checks that the Agent is the registry's live instance, that it is running, and that it is the current initiator; a call that fails those checks raises `DRAFT_TOOL_AGENT_REQUIRED` instead of guessing a Session. Argument checks run before the service call: a new draft requires a body and rejects a `draft_id` or `revision`, and an existing draft requires both `draft_id` and `revision`. Model content is the canonical JSON of the returned value, and the Host service owns the durable revision history.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: the two tools, the shared draft section, output schemas, and render/present helpers |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Workbench package](../workbench/README.md) — the Host draft domain, the article library, and the `/draft` command these tools read.
- [Experimental group map](../README.md) — the sibling packages in this group.

-----

<a id="model-experience"></a>
## Model Experience

### Shared system prompt

#### What the model sees

One `tool:prompt-draft` section in every assembled prompt while this package is visible in the calling Agent's scope. The section carries the draft's id, revision, title, and body between `<prompt_draft>` tags, and is empty while no draft is current. A `complete: true` system-prompt override replaces ordinary sections, including this one.

##### The draft section's shape

```markdown
<prompt_draft>
id: <draft id>
revision: <draft revision>
title: <draft title>

<draft body>
</prompt_draft>
```

#### Token effect

The section repeats the whole draft body in every assembled prompt, so a long draft costs its full length per turn. Scopes that do not mount the package pay nothing.

#### KV Cache effect

The section text changes whenever the draft changes, so reuse is invalidated from the first changed draft token. A stable draft keeps the prefix stable.

### Tool schemas

#### What the model sees

The generated [`get_prompt_draft` and `update_prompt_draft` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-prompt-draft) whenever this package is visible in the calling Agent's scope. `update_prompt_draft` declares optional `draft_id`, `revision`, `title`, and `body` parameters; the descriptions state that the id and revision come from `get_prompt_draft`.

#### Token effect

A fixed schema cost on every request from an Agent whose preset mounts the package. Agents under a preset that omits the row pay nothing.

#### KV Cache effect

Prefix-stable while tool definitions and visibility are unchanged. Mounting, disposal, or a scope change may invalidate reuse from the first changed schema token.

### Draft results

#### What the model sees

One canonical JSON text block per call. `get_prompt_draft` returns `{ draft: null }` when no draft exists, otherwise `{ draft: { id, revision, title, body, createdAt, updatedAt } }`. `update_prompt_draft` returns the same shape for the created or updated draft. A rejected call returns a structured error: the tool's own `DRAFT_TOOL_AGENT_REQUIRED` or `DRAFT_TOOL_INVALID_UPDATE`, or the domain's `DRAFT_STALE_REVISION` when the named revision is no longer current.

#### Token effect

Results remain in the calling Session's history until compaction, and every read repeats the whole draft body, so the body is paid for again in each later request.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV Cache entries.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No tools without the Host service** — a composition that mounts this package without `ctx.promptDrafts` leaves the plugin pending, so neither tool registers.
- **Every call needs a live calling Agent** — a call dispatched without the registry's live running initiator raises `DRAFT_TOOL_AGENT_REQUIRED` rather than guessing a Session.
- **One draft per Session** — the domain holds a single current draft with a revision history; a second concurrent writer is refused by the compare-and-set check instead of overwriting.
- **The draft body is repeated in full** — the section and every read result carry the whole body, so a long draft costs its full length on each turn; the package adds no truncation.
- **Draft state belongs to the Host** — the tools add no clock, no storage, and no revision policy of their own; those limits are the service's.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
