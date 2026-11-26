---
description: "Preset-scoped article-library tools (list_articles, get_article, save_article) over the Host ctx.articles service, for deployments choosing which agents may read and write the shared article library."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-articles

English | [中文](README.zh.md)

## Summary

Use `dsh-tool-articles` to let an agent list, read, and store finished pieces in the workbench article library through `list_articles`, `get_article`, and `save_article`. The library is a durable store every conversation of the profile shares; it belongs to the Host `@deepseek-ai/dsh-workbench` package and its records never enter the Session log. The package registers the three tools in the preset or Agent scope that mounts it, so a preset decides which agents receive them. A `tool:articles` system-prompt section tells the model the library exists. Failures return one structured error code.

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

Add the row below to a preset's plugin list when that preset's agents should read and write the shared article library. The shipped workbench preset mounts it.

### When to choose it

Choose it for any preset whose agents publish finished pieces, and load `@deepseek-ai/dsh-workbench` in the same process: this package is only the model-facing consumer of that library. A preset that omits the row exposes no article tool, and its agents see no article guidance in the system prompt.

### The three tools

- `list_articles(status?)` — List the stored articles, newest update first. `status` keeps only `draft`, `ready`, or `published` articles; omit it to list every article. Each row carries the article's `id`, `title`, `sessionId`, `status`, `updatedAt`, and a short body excerpt.
- `get_article(article_id)` — Read one stored article by the id `list_articles` returned. The result carries the full article body; an unknown id returns `null`.
- `save_article(title, body, sessionId, id?, status?)` — Store a finished piece in the library, or revise one already there. Pass the `id` of an existing article to replace it; omit the id to store a new piece. The library is shared by every conversation, and `sessionId` records the conversation the piece came from.

### Minimal configuration

```yaml
- name: '@deepseek-ai/dsh-tool-articles'
```

The package declares no `Config` fields. It injects `ctx.articles`, `ctx.tools`, and `ctx.systemPrompt` and registers the three tools and the shared library section once that scope resolves the Host `ctx.articles` service, so a composition that keeps that service off mounts no article tool.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin registers three `defineTool` definitions and one `tool:articles` system-prompt section in the scope that resolves `ctx.articles`, so a preset mount decides visibility and Cordis effect ownership disposes them with the mount. The section names the library and the three calls the model can make. The read pair awaits the Host service, so a library that is still opening delays the result rather than failing. The listing renders each body as a whitespace-flattened excerpt of at most 200 characters; the reader returns the full body. The writer passes the model's fields to the Host service, which owns the identity, the timestamps, and the default `draft` state. Model content is the canonical JSON of the returned value.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: the three tools, the shared library section, output schemas, and render/present helpers |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Workbench package](../workbench/README.md) — the Host article library and the browser panel that reads the same records.
- [Experimental group map](../README.md) — the sibling packages in this group.

-----

<a id="model-experience"></a>
## Model Experience

### Shared system prompt

#### What the model sees

One `tool:articles` section in every assembled prompt while this package is visible in the calling Agent's scope. It names the shared library and the three calls the model can make. A `complete: true` system-prompt override replaces ordinary sections, including this one.

##### The library section's shape

```markdown
<article_library>
The workbench keeps saved articles in a durable library that every conversation shares.
Call list_articles to see which articles exist, and get_article with an article id to read one.
Call save_article to store a finished piece in the library; pass the id of an existing article to revise it.
</article_library>
```

#### Token effect

One fixed paragraph per assembled prompt. Scopes that do not mount the package pay nothing.

#### KV Cache effect

Prefix-stable while the section text and tool visibility are unchanged. Mounting, disposal, or filtering may invalidate reuse from this section.

### Tool schemas

#### What the model sees

The generated [`list_articles`, `get_article`, and `save_article` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-articles) whenever this package is visible in the calling Agent's scope. `save_article` declares `title`, `body`, and `sessionId` as required and `id` and `status` as optional; `get_article` declares a required `article_id`.

#### Token effect

A fixed schema cost on every request from an Agent whose preset mounts the package. Agents under a preset that omits the row pay nothing.

#### KV Cache effect

Prefix-stable while tool definitions and visibility are unchanged. Mounting, disposal, or a scope change may invalidate reuse from the first changed schema token.

### Article results

#### What the model sees

One canonical JSON text block per call. `list_articles` returns `{ articles: [...] }` with each article's id, title, session id, status, update time, and excerpt. `get_article` returns `{ article: null }` for an unknown id, otherwise the article with its full body and both timestamps. `save_article` returns the stored article as the library now holds it, including the identity and timestamps the Host service assigned.

#### Token effect

Results remain in the calling Session's history until compaction; a listing costs one excerpt per article, and a read costs the full body on every later request.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV Cache entries.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No tools without the Host service** — a composition that mounts this package without `ctx.articles` leaves the plugin pending, so none of the three tools register.
- **Every tool reaches every stored article** — the library is shared by every conversation of the profile, so the model can read and revise pieces other conversations wrote. The Host applies no per-Session ownership check.
- **The listing truncates the body** — `list_articles` returns at most 200 characters of each body; reading the full text costs a separate `get_article` call.
- **The writer cannot delete** — this package stores and revises articles only; the Host `ctx.articles` service owns deletion, and the browser panel exposes it.
- **Article state belongs to the Host** — the tools add no clock, no storage, and no publication policy of their own; those limits are the service's.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
