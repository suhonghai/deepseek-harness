---
description: "A publishing workbench bundle: the panel a creator works in, the prompt draft the agent refines with the author, and the surfaces — articles, assets, publishing — that make up the product."
kind: "package-bundle"
---

# @deepseek-ai/dsh-workbench

English | [中文](README.zh.md)

## Summary

A publishing workbench bundle for the Web client. It contributes one sidebar-right tab — the workbench a creator works in beside the conversation — and the four surfaces that product is made of: the generation prompt the agent refines with the author, the article library, the asset library, and the publishing queue. The generation prompt and article library are wired to real data; the other two are placeholders.

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

The bundle contributes one tab to the session's sidebar-right column. The guide page gains a Workbench card; choosing it opens the tab beside the conversation, and the column collapses on demand so the chat keeps the full width. The panel lists the four surfaces the product is made of: the generation prompt, articles, assets, and publishing. The generation-prompt section reads the **current Session's** draft — the tab's seat is session-scoped, so it shows that conversation's draft rather than one picked across every Session — and renders its body, revision, and retained version count; the articles section reads the library and lists stored pieces newest-first across draft / ready / published states. Assets and publishing still render a "not built yet" badge.

The prompt draft works the way the product needs it to. You talk to the agent and you both edit one article-generation prompt. The draft is a session-scoped state: the agent reads it with `get_prompt_draft` and rewrites it with `update_prompt_draft`, and you read it with the `/draft` command — `/draft` on its own shows the current text, `/draft <text>` replaces the body, and `/draft clear` empties it. Every revision carries a number, and the bundle keeps the superseded revisions so you can see how the prompt got to where it is.

The draft is not a side channel: its body is in the system prompt of every turn, so "make it shorter" lands on the exact text you just read rather than on a summary of it.

The conversation itself is not part of this bundle. A chat keeps the Agent preset it started with, so a session that began on the Standard preset keeps Standard's tool set.

Installing the bundle is what puts the panel on screen and the draft in the session. The bundle declares `dsh.bundle.patch`, so adding `@deepseek-ai/dsh-workbench` to a profile's `dsh.profile.bundles` is the whole installation; the browser half loads on demand from the same manifest that declares its client dependencies.

<a id="understand-the-implementation"></a>
## Understand the implementation

The package has two faces. The host face (`src/index.ts`) mounts the article library, the prompt-draft domain, and the `/draft` command. The browser face (`src/client/`) registers the workbench as a sidebar-right tab: it declares the tab type in `ctx.sidebarRightTabs` and registers its body under `sidebar.right.pane.tab` with the same id, the two-step registration the shipped Plan preview and Changes review pages use. The seat is session-scoped, so the body reads the current Session's draft through `useProjection` with no extra API. The browser face mounts this package's `remote` contract in `apply`, gains the `articles` Remote namespace, and tears the Remote down symmetrically with the UI.

The host face is split into one file per concern under `src/host/`. `article-domain.ts` holds the domain declaration, record schema, and Remote boundary types; `article-service.ts` owns `ctx.articles` (over the base bundle's storage-domain / json backend). `types.ts` aggregates both domains' pure types and is the package's `./types` subpath. `draft-types.ts` holds the pure types and the `promptDraft` projection-key declaration, free of host imports so the browser half can project the same content. `draft-domain.ts` holds the durable change payloads and the `prompt-draft/change` session event. `draft-fold.ts` is the pure replay fold and its strict decoder. `draft-runtime.ts` holds the error codes and the change version. `draft-service.ts` owns the `ctx.promptDrafts` service and `draft-command.ts` owns the human-facing surface. The two model-facing surfaces live in their own packages, `@deepseek-ai/dsh-tool-prompt-draft` and `@deepseek-ai/dsh-tool-articles`, because a tool registers inside the Agent scope that mounts it and the workbench preset decides which agents receive them.

The panel reads from two sources: drafts come from the `promptDraft` session projection (pushed live over the Control Stream, read across every Session through the global `useSessions` hook and picking the most recently updated one), and articles come from the `articles` Remote (`articles-store.ts` reads once on mount and again on connection reset). The panel is global and bound to no single Session.

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

Nothing from the panel itself. The panel is a client-side view: the browser face calls `ctx.sidebarRightTabs.register` and `ctx.slots.register` for the `sidebar.right.pane.tab` seat, and the panel contributes no tool, no prompt section, and no session event.

#### Token effect

None. The panel adds no request payload, no system prompt, and no tool schema.

#### KV Cache effect

Unchanged. The panel adds no prefix to any model request, so request caching behaves exactly as it does without it.

### Model-facing tools

#### What the model sees

Nothing from this package itself. The workbench host face registers no tool, no prompt section, and no model-visible event; the draft body and the article library reach the model only through the two tool packages the workbench preset mounts, `@deepseek-ai/dsh-tool-prompt-draft` and `@deepseek-ai/dsh-tool-articles`. Those packages own the prompt sections and the tool schemas, and each one documents what the model receives.

#### Token effect

None on its own. The token cost of the draft section and of the five tool schemas belongs to the two tool packages, and a preset that omits those rows pays neither.

#### KV Cache effect

Unchanged. The workbench adds no prefix to any model request; the cache effects of the draft section and the tool schemas belong to the two tool packages.

## Known Limitations and Deferred Work

- The asset library and the publishing queue are still placeholders. The generation prompt and article library surfaces are wired to real data.
- The panel only reads the article library; it offers no UI to edit an article, move its publication state, or delete it. The model writes and revises articles through `save_article`; a human-facing editor is left to a later release.
- The panel shows the most recently updated draft. The draft is one per session; across several Sessions it picks the one with the largest `updatedAt`. A selection rule for a second draft is not part of this release.
- The article list is read on mount and on connection reset; there is no live push subscription for articles a model writes mid-session, so an immediate refresh still needs a reconnect or reload.
