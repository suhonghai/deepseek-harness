/**
 * The article library unit: one durable store shared across sessions, with
 * validation at the medium boundary, compare-and-set-free whole-record writes,
 * and a status filter over the newest-updated-first listing.
 *
 * The Host service is the single writer; these tests mount it over an in-memory
 * storage backend (the shared domain test double), so nothing touches disk.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage, { storageBackendServiceKey } from '@deepseek-ai/dsh-storage'
import { apply as mountDomain } from '@deepseek-ai/dsh-storage-domain'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import ArticleService from '../src/host/article-service.ts'

/** Boot a context with the storage hub, the domain facility, and the article service over memory. */
async function harness(): Promise<{ ctx: Context; articles: ArticleService }> {
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
  await ctx.plugin(ArticleService)
  return { ctx, articles: ctx.articles }
}

describe('article library service', () => {
  it('starts with an empty library', async () => {
    const { articles } = await harness()
    expect(await articles.list({})).toEqual([])
    expect(await articles.get('missing')).toBeUndefined()
  })

  it('stores an article with a generated id, draft status, and timestamps', async () => {
    const { articles } = await harness()
    const record = await articles.put({ title: 'Hello', body: 'World', sessionId: 'session-1' })
    expect(record.id).toMatch(/^article-/)
    expect(record).toMatchObject({ title: 'Hello', body: 'World', sessionId: 'session-1', status: 'draft' })
    expect(record.createdAt).toBeGreaterThan(0)
    expect(record.updatedAt).toBeGreaterThanOrEqual(record.createdAt)
    expect(await articles.get(record.id)).toEqual(record)
  })

  it('reuses the identity and creation time when replacing by id', async () => {
    const { articles } = await harness()
    const first = await articles.put({ id: 'fixed', title: 'One', body: 'A', sessionId: 's' })
    await new Promise(resolve => setTimeout(resolve, 2))
    const second = await articles.put({ id: 'fixed', title: 'Two', body: 'B', sessionId: 's', status: 'published' })
    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt)
    expect(await articles.list({})).toHaveLength(1)
    expect(await articles.get('fixed')).toMatchObject({ title: 'Two', body: 'B', status: 'published' })
  })

  it('lists newest updates first and filters by status', async () => {
    const { articles } = await harness()
    const older = await articles.put({ id: 'old', title: 'Old', body: 'x', sessionId: 's', status: 'draft' })
    await new Promise(resolve => setTimeout(resolve, 2))
    const newer = await articles.put({ id: 'new', title: 'New', body: 'y', sessionId: 's', status: 'ready' })
    const all = await articles.list({})
    expect(all.map(a => a.id)).toEqual([newer.id, older.id])
    expect((await articles.list({ status: 'draft' })).map(a => a.id)).toEqual([older.id])
    expect((await articles.list({ status: 'ready' })).map(a => a.id)).toEqual([newer.id])
    expect(await articles.list({ status: 'published' })).toEqual([])
  })

  it('updates only the supplied fields and rejects an empty patch', async () => {
    const { articles } = await harness()
    const created = await articles.put({ id: 'u', title: 'Title', body: 'Body', sessionId: 's' })
    const updated = await articles.update('u', { status: 'ready' })
    expect(updated).toMatchObject({ title: 'Title', body: 'Body', sessionId: 's', status: 'ready' })
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
    await expect(articles.update('u', {})).rejects.toMatchObject({ code: 'workbench-articles/invalid' })
  })

  it('rejects an unknown article and an invalid field', async () => {
    const { articles } = await harness()
    await expect(articles.update('nope', { title: 'x' })).rejects.toMatchObject({ code: 'workbench-articles/not-found' })
    await expect(articles.put({ title: ' ', body: 'x', sessionId: 's' }))
      .rejects.toMatchObject({ code: 'workbench-articles/invalid' })
  })

  it('removes an article and reports whether a key existed', async () => {
    const { articles } = await harness()
    await articles.put({ id: 'gone', title: 'Gone', body: 'x', sessionId: 's' })
    expect(await articles.delete('gone')).toBe(true)
    expect(await articles.delete('gone')).toBe(false)
    expect(await articles.get('gone')).toBeUndefined()
  })
})
