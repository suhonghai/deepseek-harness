/**
 * The workbench article library: one durable store shared by every session of
 * the profile. The client reads and edits it through the `articles` Remote
 * namespace; the model reads it through the article tools. The stored records
 * never enter the session log.
 *
 * @module @deepseek-ai/dsh-workbench/host/article-service
 */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { DomainError } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import {
  articleStatus,
  articlesDomainSpec,
  type ArticleInput,
  type ArticleListRequest,
  type ArticlePatch,
  type ArticleRecord,
  type ArticleStatus,
} from './article-domain.ts'

export type {
  ArticleInput,
  ArticleListRequest,
  ArticlePatch,
  ArticleRecord,
  ArticleStatus,
} from './article-domain.ts'
export { articleRecord, articlesDomainSpec, articleStatus } from './article-domain.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The durable article library shared by every session of the profile. */
    articles: ArticleService
  }
}

/**
 * Reject an unusable article field before it reaches the durable medium.
 * @param value - the field value the caller sent.
 * @param field - the field name, for the diagnostic.
 * @param articleId - the article the field belongs to.
 * @returns the accepted value.
 */
function requireText(value: string, field: string, articleId: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RemoteError(
      'workbench-articles/invalid',
      `article ${field} must be a non-empty string`,
      { articleId, field },
    )
  }
  return value
}

/**
 * Reject an unknown publication state before it reaches the durable medium.
 * @param value - the state the caller sent.
 * @param articleId - the article the state belongs to.
 * @returns the accepted state.
 */
function requireStatus(value: ArticleStatus, articleId: string): ArticleStatus {
  if (!articleStatus.options.includes(value)) {
    throw new RemoteError(
      'workbench-articles/invalid',
      `article status must be one of ${articleStatus.options.join(', ')}`,
      { articleId, field: 'status' },
    )
  }
  return value
}

/** The article library service (`ctx.articles`), backed by one storage domain. */
export class ArticleService extends TypertRemoteService {
  static inject = ['storageDomain']

  /** The opened domain; every table access waits for it. */
  private readonly ready: Promise<Domain<typeof articlesDomainSpec>>

  constructor(ctx: Context) {
    super(ctx, 'articles')
    const facility = ctx.get('storageDomain')
    if (facility === undefined) {
      throw new Error(
        'the article library needs a storage domain service (dsh-storage-domain), '
        + 'which this deployment did not compose',
      )
    }
    this.ready = facility.open(articlesDomainSpec)
    ctx.effect(() => async () => {
      // A failed open leaves no domain to close, so the rejection is dropped
      // here and reported by the service init that awaits the same promise.
      const domain = await this.ready.catch(() => undefined)
      if (domain !== undefined) await domain.close()
    }, 'workbench.articles.domainClose')
  }

  /** Open the domain before the service accepts work. */
  protected async [Service.init](): Promise<void> {
    await this.ready
  }

  /**
   * List the stored articles, most recently updated first.
   * @param request - Optional publication-state filter.
   * @returns The matching articles, newest update first.
   */
  @Remote('list')
  async list(request: ArticleListRequest = {}): Promise<ArticleRecord[]> {
    const table = await this.table()
    const status = request.status
    const articles = [...table.entries()].map(([, record]) => record)
    const matching = status === undefined
      ? articles
      : articles.filter(record => record.status === status)
    return matching.sort((left, right) => right.updatedAt - left.updatedAt)
  }

  /**
   * Read one stored article.
   * @param id - Identity of the article.
   * @returns The stored article, or undefined when the library holds none.
   */
  @Remote('get')
  async get(id: string): Promise<ArticleRecord | undefined> {
    const table = await this.table()
    return table.get(id)
  }

  /**
   * Store one article, replacing the record that carries the same identity.
   * @param input - The article fields; the service owns the identity and the timestamps.
   * @returns The stored article.
   */
  @Remote('put')
  async put(input: ArticleInput): Promise<ArticleRecord> {
    const table = await this.table()
    const id = input.id === undefined
      ? `article-${randomUUID()}`
      : requireText(input.id, 'id', input.id)
    const title = requireText(input.title, 'title', id)
    const body = requireText(input.body, 'body', id)
    const sessionId = requireText(input.sessionId, 'sessionId', id)
    const status = input.status === undefined ? 'draft' : requireStatus(input.status, id)
    const existing = table.get(id)
    const now = Date.now()
    const record: ArticleRecord = {
      id,
      title,
      body,
      sessionId,
      status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: Math.max(now, existing?.updatedAt ?? 0),
    }
    await table.put(id, record)
    return record
  }

  /**
   * Change the fields of one stored article.
   * @param id - Identity of the article.
   * @param patch - The fields to change; at least one must be present.
   * @returns The stored article.
   */
  @Remote('update')
  async update(id: string, patch: ArticlePatch): Promise<ArticleRecord> {
    const table = await this.table()
    const title = patch.title === undefined ? undefined : requireText(patch.title, 'title', id)
    const body = patch.body === undefined ? undefined : requireText(patch.body, 'body', id)
    const sessionId = patch.sessionId === undefined ? undefined : requireText(patch.sessionId, 'sessionId', id)
    const status = patch.status === undefined ? undefined : requireStatus(patch.status, id)
    if (title === undefined && body === undefined && sessionId === undefined && status === undefined) {
      throw new RemoteError(
        'workbench-articles/invalid',
        'an article update changes a title, a body, a session, or a status',
        { articleId: id, field: 'patch' },
      )
    }
    try {
      return await table.update(id, current => ({
        ...current,
        ...title === undefined ? {} : { title },
        ...body === undefined ? {} : { body },
        ...sessionId === undefined ? {} : { sessionId },
        ...status === undefined ? {} : { status },
        updatedAt: Math.max(Date.now(), current.updatedAt),
      }))
    } catch (error: unknown) {
      if (error instanceof DomainError && error.code === 'missing-key') {
        throw new RemoteError('workbench-articles/not-found', `Unknown article: ${id}`, { articleId: id })
      }
      throw error
    }
  }

  /**
   * Delete one stored article.
   * @param id - Identity of the article.
   * @returns Whether an article was removed.
   */
  @Remote('remove')
  async remove(id: string): Promise<boolean> {
    const table = await this.table()
    return table.delete(id)
  }

  /** The article table of the opened domain. */
  private async table(): Promise<KvTable<string, ArticleRecord>> {
    const domain = await this.ready
    return domain.table('articles')
  }
}

export default ArticleService
