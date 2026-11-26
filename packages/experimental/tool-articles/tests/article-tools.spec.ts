/**
 * The model-facing article tools: registration, the read pair, and the writer.
 *
 * The tools are mounted over the same in-memory storage domain the service
 * tests use, so a write through `save_article` is observable through
 * `list_articles` and `get_article` without touching disk.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import Storage, { storageBackendServiceKey } from '@deepseek-ai/dsh-storage'
import { apply as mountDomain } from '@deepseek-ai/dsh-storage-domain'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import ArticleService from '@deepseek-ai/dsh-workbench/src/host/article-service.ts'
import * as articleTools from '../src/index.ts'

/** Boot the article service and the model-facing tools over one memory backend. */
async function harness(): Promise<{ ctx: Context }> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new MemoryStorageBackend()
  ctx.storage.backend.register('memory', backend)
  ctx.provide(storageBackendServiceKey('memory'), backend)
  await ctx.plugin({
    name: 'storage-domain',
    inject: ['storage'],
    apply: domainCtx => mountDomain(domainCtx, { backend: 'memory', routes: {} }),
  })
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(ArticleService)
  await ctx.plugin({
    name: articleTools.name,
    inject: articleTools.inject,
    apply: articleTools.apply,
  })
  await ctx.fiber.await()
  return { ctx }
}

/** Run one tool call through the real execution pipeline. */
async function call(ctx: Context, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await executeToolFixture(ctx, {
    callId: brandString<ToolCallId>('article-call'),
    signal: new AbortController().signal,
    name,
    arguments: args,
  })
  if (result.isError) throw result.error
  return result.content
}

/** The JSON text block a tool result carries. */
function text(content: unknown): unknown {
  const block = (content as { text: string }[])[0]
  return JSON.parse(block?.text ?? '')
}

describe('article model tools', () => {
  it('registers the read pair and the writer', async () => {
    const { ctx } = await harness()
    for (const name of ['list_articles', 'get_article', 'save_article']) {
      expect(ctx.tools.get(name), `tool ${name} must be registered`).toBeDefined()
    }
  })

  it('stores a new article and reads it back through the read tools', async () => {
    const { ctx } = await harness()
    const saved = text(await call(ctx, 'save_article', {
      title: '模型写的文章',
      body: '正文',
      sessionId: 'session-1',
    })) as { article: { id: string; title: string; body: string; status: string } }

    expect(saved.article.title).toBe('模型写的文章')
    expect(saved.article.body).toBe('正文')
    expect(saved.article.status).toBe('draft')
    expect(saved.article.id).toMatch(/^article-/)

    const listed = text(await call(ctx, 'list_articles', {})) as { articles: { id: string; title: string }[] }
    expect(listed.articles.map(article => article.id)).toEqual([saved.article.id])
    expect(listed.articles[0]?.title).toBe('模型写的文章')

    const read = text(await call(ctx, 'get_article', { article_id: saved.article.id })) as {
      article: { body: string } | null
    }
    expect(read.article?.body).toBe('正文')
  })

  it('revises an existing article when the writer is given its id', async () => {
    const { ctx } = await harness()
    const first = text(await call(ctx, 'save_article', {
      title: '初稿',
      body: '初稿正文',
      sessionId: 'session-1',
    })) as { article: { id: string; createdAt: number } }

    const revised = text(await call(ctx, 'save_article', {
      id: first.article.id,
      title: '定稿',
      body: '定稿正文',
      sessionId: 'session-1',
    })) as { article: { id: string; title: string; createdAt: number } }

    expect(revised.article.id).toBe(first.article.id)
    expect(revised.article.title).toBe('定稿')
    expect(revised.article.createdAt).toBe(first.article.createdAt)

    const listed = text(await call(ctx, 'list_articles', {})) as { articles: unknown[] }
    expect(listed.articles).toHaveLength(1)
  })

  it('filters the listing by publication state', async () => {
    const { ctx } = await harness()
    await call(ctx, 'save_article', {
      title: '草稿件',
      body: 'x',
      sessionId: 'session-1',
    })
    await call(ctx, 'save_article', {
      title: '成稿件',
      body: 'y',
      sessionId: 'session-1',
      status: 'published',
    })

    const drafts = text(await call(ctx, 'list_articles', { status: 'draft' })) as { articles: { title: string }[] }
    expect(drafts.articles.map(article => article.title)).toEqual(['草稿件'])

    const published = text(await call(ctx, 'list_articles', { status: 'published' })) as { articles: { title: string }[] }
    expect(published.articles.map(article => article.title)).toEqual(['成稿件'])
  })
})
