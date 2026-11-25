/**
 * The article library's durable declaration: the storage-domain spec, the
 * record schema validated at the medium boundary, and the wire vocabulary the
 * client and the model read.
 *
 * @module @deepseek-ai/dsh-workbench/host/article-domain
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** Publication state of one article. */
export const articleStatus = z.enum(['draft', 'ready', 'published'])

/** Publication state of one article. */
export type ArticleStatus = z.infer<typeof articleStatus>

/**
 * Durable shape of one article. `sessionId` records the conversation the
 * article came from, so a piece stays attributable to the session that
 * produced it. `createdAt` and `updatedAt` are epoch milliseconds.
 */
export const articleRecord = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  sessionId: z.string(),
  status: articleStatus,
  createdAt: z.number(),
  updatedAt: z.number(),
})

/** One stored article, inferred from {@link articleRecord}. */
export type ArticleRecord = z.infer<typeof articleRecord>

/**
 * The article library's domain spec: one `articles` table keyed by the
 * article id. The owning plugin opens it through the storage domain facility;
 * the spec is the single source of the domain's identity, version, and record
 * schema.
 */
export const articlesDomainSpec = defineDomain({
  name: 'workbench_articles',
  version: 1,
  tables: { articles: domainTable<string, ArticleRecord>(articleRecord) },
})

/** Request for the article list. */
export interface ArticleListRequest {
  /** Keep only the articles in this publication state. */
  readonly status?: ArticleStatus
}

/** Fields one stored article carries; the service owns the identity and the timestamps. */
export interface ArticleInput {
  /** Identity of the article to replace; the service generates one when omitted. */
  readonly id?: string
  /** Human title of the article. */
  readonly title: string
  /** The article body. */
  readonly body: string
  /** The conversation the article came from. */
  readonly sessionId: string
  /** Publication state; the service stores `draft` when omitted. */
  readonly status?: ArticleStatus
}

/** Fields one article update changes; at least one must be present. */
export interface ArticlePatch {
  /** Replacement title. */
  readonly title?: string
  /** Replacement body. */
  readonly body?: string
  /** Replacement conversation attribution. */
  readonly sessionId?: string
  /** Replacement publication state. */
  readonly status?: ArticleStatus
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** No stored article carries the requested identity. */
    'workbench-articles/not-found': { readonly articleId: string }
    /** The article fields the caller sent are not usable. */
    'workbench-articles/invalid': { readonly articleId: string; readonly field: string }
  }
}
