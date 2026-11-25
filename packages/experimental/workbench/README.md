---
description: "A publishing workbench bundle: the panel a creator works in, and the surfaces — generation prompt, articles, assets, publishing — that make up the product."
kind: "package-bundle"
---

# @deepseek-ai/dsh-workbench

English | [中文](README.zh.md)

## Summary

A publishing workbench bundle for the Web client. It contributes one global panel — the workbench a creator works in — and the four surfaces that product is made of: the generation prompt the agent refines with the author, the article library, the asset library, and the publishing queue. In this release the panel is the frame those surfaces will live in; they are placeholders.

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

The bundle contributes one global panel to the Web client. The sidebar gains a Workbench entry; choosing it swaps the main area over to the workbench panel, and choosing the conversation entry returns to the chat. The panel lists the four surfaces the product is made of: the generation prompt, articles, assets, and publishing. Each surface renders its title, a one-line purpose, and a "not built yet" badge.

The conversation itself is not part of this bundle. A chat keeps the Agent preset it started with, so a session that began on the Standard preset keeps Standard's tool set. What this bundle will add is the prompt draft that the conversation edits: a session-scoped state the agent reads and writes while you talk, and a view that shows its current text and revision history.

Installing the bundle is what puts the panel on screen. The bundle declares `dsh.bundle.patch`, so adding `@deepseek-ai/dsh-workbench` to a profile's `dsh.profile.bundles` is the whole installation; the browser half loads on demand from the same manifest that declares its client dependencies.

<a id="understand-the-implementation"></a>
## Understand the implementation

The package has two faces. The host face (`src/index.ts`) is an empty plugin body — its only job is to give the package a Loader row, without which the browser half never loads. The browser face (`src/client/`) registers the panel on the `main` keyed slot of the layout service and the sidebar entry on the `sidebar.panellist` list slot, the same two slots the shipped Plugins page uses. The sidebar owns the button, the label, and the selected state; the panel contributes content only.

Panel content is a plain React component whose props come from the slot renderer: `PropsRuntime<'main'>` for the runtime share and `PropsLocale<'workbench'>` for the dictionary. Copy lives in `src/client/locales.ts` and is registered under the `workbench` namespace in all eight shipped locales.

<a id="further-exploration"></a>
## Further Exploration

- `packages/client/ui-layout` — the `main` slot and `selectPanel` that switch the main area
- `packages/client/ui-sidebar` — the panel list the sidebar renders
- `packages/client/ui-plugin-manager` — the shipped page that registers a `main` panel the same way
- `packages/preset/agent-preset-registry` — the Agent presets a conversation runs with

<a id="dev-note"></a>
## Dev Note

The bundle resolves its package name from the profile's `node_modules`, because a bundle name resolves first from the dsh installation and then from the profile directory. A profile that does not carry the package therefore resolves nothing, and the failure is silent — no row, no log line. `scripts/dev-setup.sh` links the workspace package into the profile directory for this reason; a profile installed from npm gets the package from its own dependency tree instead.

<a id="model-experience"></a>
## Model Experience

### Workbench panel

#### What the model sees

Nothing. The panel is a client-side view: the browser face calls `ctx.slots.register` for the `main` and `sidebar.panellist` slots, and the host face registers no tool, no prompt section, and no session event. Installing this bundle leaves a conversation's model-visible input unchanged.

#### Token effect

None. No request payload, no system prompt, and no tool schema changes.

#### KV Cache effect

Unchanged. The bundle adds no prefix to any model request, so request caching behaves exactly as it does without it.

## Known Limitations and Deferred Work

- The four panel surfaces are placeholders. The prompt draft, the article list, the asset library, and the publishing queue are all still to be built.
- The package has no host-side capability yet, so there is nothing for the agent to read or write. The prompt draft domain is the first thing that belongs on the host face.
- The panel does not yet reach the article data. Whether that data lives in the Harness session store or in the product's own database is still open.
