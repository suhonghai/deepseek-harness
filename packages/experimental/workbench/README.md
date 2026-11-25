---
description: "A publishing workbench bundle: the panel a creator works in, the prompt draft the agent refines with the author, and the surfaces — articles, assets, publishing — that make up the product."
kind: "package-bundle"
---

# @deepseek-ai/dsh-workbench

English | [中文](README.zh.md)

## Summary

A publishing workbench bundle for the Web client. It contributes one global panel — the workbench a creator works in — and the four surfaces that product is made of: the generation prompt the agent refines with the author, the article library, the asset library, and the publishing queue. The panel is the frame those surfaces live in; the generation prompt surface is real, the other three are placeholders.

The prompt draft is the bundle's host capability. It is one draft per session, persisted in the session log, with a revision the model and the user compare against each other.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

The bundle contributes one global panel to the Web client. The sidebar gains a Workbench entry; choosing it swaps the main area over to the workbench panel, and choosing the conversation entry returns to the chat. The panel lists the four surfaces the product is made of: the generation prompt, articles, assets, and publishing. Each surface renders its title and a one-line purpose; the generation prompt surface is the only one whose content is wired, and the other three still render a "not built yet" badge.

The prompt draft works the way the product needs it to. You talk to the agent and you both edit one article-generation prompt. The draft is a session-scoped state: the agent reads it with `get_prompt_draft` and rewrites it with `update_prompt_draft`, and you read it with the `/draft` command — `/draft` on its own shows the current text, `/draft <text>` replaces the body, and `/draft clear` empties it. Every revision carries a number, and the bundle keeps the superseded revisions so you can see how the prompt got to where it is.

The draft is not a side channel: its body is in the system prompt of every turn, so "make it shorter" lands on the exact text you just read rather than on a summary of it.

The conversation itself is not part of this bundle. A chat keeps the Agent preset it started with, so a session that began on the Standard preset keeps Standard's tool set.

Installing the bundle is what puts the panel on screen and the draft in the session. The bundle declares `dsh.bundle.patch`, so adding `@deepseek-ai/dsh-workbench` to a profile's `dsh.profile.bundles` is the whole installation; the browser half loads on demand from the same manifest that declares its client dependencies.

<a id="understand-the-implementation"></a>
## Understand the implementation

The package has two faces. The host face (`src/index.ts`) mounts the prompt-draft domain, its two model tools, and the `/draft` command. The browser face (`src/client/`) registers the panel on the `main` keyed slot of the layout service and the sidebar entry on the `sidebar.panellist` list slot, the same two slots the shipped Plugins page uses. The sidebar owns the button, the label, and the selected state; the panel contributes content only.

The host face is split into one file per concern under `src/host/`. `draft-types.ts` holds the pure types and the `promptDraft` projection-key declaration, free of host imports so the browser half can project the same content. `draft-domain.ts` holds the durable change payloads and the `prompt-draft/change` session event. `draft-fold.ts` is the pure replay fold and its strict decoder. `draft-runtime.ts` holds the error codes and the change version. `draft-service.ts` owns the `ctx.promptDrafts` service, and `draft-tools.ts` and `draft-command.ts` own the model-facing and human-facing surfaces.

The domain is event-sourced. One session event, `prompt-draft/change`, records every mutation: a create carries the initial content, an update carries only the content that changed together with the revision it advances from and the revision it produces, and a clear carries a tombstone. The session projection composes those events into the current whole draft and the retained revision history. Because an update carries only what changed, a title-only edit does not copy the body into the log again.

Mutations are compare-and-set: an update names the revision it read, and a stale revision is rejected rather than applied over a newer one. The service also refuses any caller that is not the exact live agent the registry owns, so one session cannot rewrite another's draft.

Panel content is a plain React component whose props come from the slot renderer: `PropsRuntime<'main'>` for the runtime share and `PropsLocale<'workbench'>` for the dictionary. Copy lives in `src/client/locales.ts` and is registered under the `workbench` namespace in all eight shipped locales.

<a id="further-exploration"></a>
## Further Exploration

- `packages/client/ui-layout` — the `main` slot and `selectPanel` that switch the main area
- `packages/client/ui-sidebar` — the panel list the sidebar renders
- `packages/client/ui-plugin-manager` — the shipped page that registers a `main` panel the same way
- `packages/preset/agent-preset-registry` — the Agent presets a conversation runs with
- `packages/goal/goal` — the same-session event-sourced domain shape, with the goal's continuation lifecycle the draft does not have

<a id="dev-note"></a>
## Dev Note

The bundle resolves its package name from the profile's `node_modules`, because a bundle name resolves first from the dsh installation and then from the profile directory. A profile that does not carry the package therefore resolves nothing, and the failure is silent — no row, no log line. `scripts/dev-setup.sh` links the workspace package into the profile directory for this reason; a profile installed from npm gets the package from its own dependency tree instead.

The domain deliberately keeps no phase machine, no activation state, and no process-local fields. Every fact a reader can observe comes out of the session log, so a resumed session sees the same draft a live one does. The retained revision history is a deployment choice, not a protocol constant: `maxVersions` on the service configuration bounds how many superseded revisions the projection keeps, and the default is twenty.

The draft's body is rendered into the system prompt through a section whose text is a function of the assembling session, so the prompt carries the text of the session that asked for it and not of any other.

<a id="model-experience"></a>
## Model Experience

### Workbench panel

#### What the model sees

Nothing from the panel itself. The panel is a client-side view: the browser face calls `ctx.slots.register` for the `main` and `sidebar.panellist` slots, and the panel contributes no tool, no prompt section, and no session event.

#### Token effect

None. The panel adds no request payload, no system prompt, and no tool schema.

#### KV Cache effect

Unchanged. The panel adds no prefix to any model request, so request caching behaves exactly as it does without it.

### Prompt draft

#### What the model sees

The draft's own text, in every turn. A prompt section renders the current draft's id, revision, title, and body; the body is the author's text, so it is data the package passes through rather than prose it owns.

##### The prompt section's shape

```markdown
<prompt_draft>
id: <draft id>
revision: <draft revision>
title: <draft title>

<draft body>
</prompt_draft>
```

#### Token effect

The draft body is added to the system prompt of every request while a draft exists, so the cost tracks the length of the draft rather than the number of edits. Without a draft the section contributes nothing.

#### KV Cache effect

Prefix-stable ahead of the section, which sits at order 2450 after the tool policies. A draft edit replaces the section's text and therefore invalidates reuse from that point rather than from the start of the system prompt.

### Draft tools

#### What the model sees

Two tools. `get_prompt_draft` returns the current draft with the id and revision that `update_prompt_draft` requires, and `update_prompt_draft` replaces the title, the body, or both and advances the revision by one. A stale revision is rejected at execution. The model may rewrite the draft whenever the author's words call for it; nothing requires the author to have typed first.

#### Token effect

Two tool definitions on every request, plus one compact JSON result per call.

#### KV Cache effect

Prefix-stable while the tool definitions are unchanged. Calls and results append after the reusable request prefix without invalidating earlier entries.

## Known Limitations and Deferred Work

- The article list, the asset library, and the publishing queue are still placeholders. Only the generation prompt surface is wired to real data.
- The browser panel does not yet read the draft. The domain publishes its state through the `promptDraft` session projection and the `promptDrafts` Remote, so the client has both channels; the panel does not use them yet.
- The panel does not yet reach the article data. Whether that data lives in the Harness session store or in the product's own database is still open.
- The draft is one per session. A second draft would need a selection rule that this release does not have.
