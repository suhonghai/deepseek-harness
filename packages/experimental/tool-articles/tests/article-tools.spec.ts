/**
 * The model-facing article tools: registration, the read pair, and the writer.
 *
 * The tools are mounted over the same in-memory storage domain the service
 * tests use, so a write through `save_article` is observable through
 * `list_articles` and `get_article` without touching disk.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage, { storageBackendServiceKey } from '@deepseek-ai/dsh-storage'
import { apply as mountDomain } from '@deepseek-ai/dsh-storage-domain'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import ArticleService from '@deepseek-ai/dsh-workbench/src/host/article-service.ts'
import * as articleTools from '../src/index.ts'

/** Boot the article service and the model-facing tools over one memory backend. */
async function harness(): Promise<{ ctx: Context; tools: Map<string, { execute: (args: unknown) => Promise<unknown> }> }> {
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
  await ctx.plugin(ArticleService)
  await ctx.plugin({
    name: articleTools.name,
    inject: articleTools.inject,
    apply: articleTools.apply,
  })
  await ctx.fiber.await()
  const tools = new Map<string, { execute: (args: unknown) => Promise<unknown> }>()
  for (const name of ['list_articles', 'get_article', 'save_article']) {
    const definition = ctx.tools.get(name)
    expect(definition, `tool ${name} must be registered`).toBeDefined()
    tools.set(name, definition!)
  }
  return { ctx, tools }
}

describe('article model tools', () => {
  it('registers the read pair and the writer', async () => {
    const { tools } = await harness()
    expect([...tools.keys()].sort()).toEqual(['get_article', 'list_articles', 'save_article'])
  })

  it('stores a new article and reads it back through the read tools', async () => {
    const { tools } = await harness()
    const saved = await tools.get('save_article')!.execute({
      title: '模型写的文章',
      body: '正文',
      sessionId: 'session-1',
    }) as { article: { id: string; title: string; body: string; status: string } }

    expect(saved.article.title).toBe('模型写的文章')
    expect(saved.article.body).toBe('正文')
    expect(saved.article.status).toBe('draft')
    expect(saved.article.id).toMatch(/^article-/)

    const listed = await tools.get('list_articles')!.execute({}) as { articles: { id: string; title: string }[] }
    expect(listed.articles.map(article => article.id)).toEqual([saved.article.id])
    expect(listed.articles[0]?.title).toBe('模型写的文章')

    const read = await tools.get('get_article')!.execute({ article_id: saved.article.id }) as {
      article: { body: string } | null
    }
    expect(read.article?.body).toBe('正文')
  })

  it('revises an existing article when the writer is given its id', async () => {
    const { tools } = await harness()
    const first = await tools.get('save_article')!.execute({
      title: '初稿',
      body: '初稿正文',
      sessionId: 'session-1',
    }) as { article: { id: string; createdAt: number } }

    const revised = await tools.get('save_article')!.execute({
      id: first.article.id,
      title: '定稿',
      body: '定稿正文',
      sessionId: 'session-1',
    }) as { article: { id: string; title: string; createdAt: number } }

    expect(revised.article.id).toBe(first.article.id)
    expect(revised.article.title).toBe('定稿')
    expect(revised.article.createdAt).toBe(first.article.createdAt)

    const listed = await tools.get('list_articles')!.execute({}) as { articles: unknown[] }
    expect(listed.articles).toHaveLength(1)
  })

  it('filters the listing by publication state', async () => {
    const { tools } = await harness()
    await tools.get('save_article')!.execute({
      title: '草稿件',
      body: 'x',
      sessionId: 'session-1',
    })
    await tools.get('save_article')!.execute({
      title: '成稿件',
      body: 'y',
      sessionId: 'session-1',
      status: 'published',
    })

    const drafts = await tools.get('list_articles')!.execute({ status: 'draft' }) as { articles: { title: string }[] }
    expect(drafts.articles.map(article => article.title)).toEqual(['草稿件'])

    const published = await tools.get('list_articles')!.execute({ status: 'published' }) as { articles: { title: string }[] }
    expect(published.articles.map(article => article.title)).toEqual(['成稿件'])
  })
})
