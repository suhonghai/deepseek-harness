/**
 * Model-facing `list_articles` and `get_article` tools over the durable
 * article library, plus the system-prompt section that tells the model the
 * library exists. The library itself is not model-visible; only what these
 * tools return is.
 *
 * @module @deepseek-ai/dsh-workbench/host/article-tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'
import type { ArticleStatus } from './article-domain.ts'
// Type-only: pulls the Context merge that declares `ctx.articles`.
import type {} from './article-service.ts'

/** The article-library tool plugin. */
export const name = 'tool-articles'

/** Services the article tools require. */
export const inject = ['articles', 'tools', 'systemPrompt']

/**
 * Prompt-section position of the article-library guidance. The central
 * allocation table in `@deepseek-ai/dsh-system-prompt` has no entry for it
 * yet; 2460 keeps the section between the prompt-draft guidance and the
 * schedule guidance.
 */
const SECTION_ORDER = 2460

/** Publication states the library stores. */
const ARTICLE_STATUSES = ['draft', 'ready', 'published'] as const

/** Characters of the body the list shows for each article. */
const EXCERPT_LENGTH = 200

const LIST_DESCRIPTION =
  'List the articles saved in the workbench library — the pieces written by earlier conversations. '
  + 'Call it to learn which articles exist and their ids; read one with get_article.'

const GET_DESCRIPTION =
  'Read one saved article by the id list_articles returned. The result carries the full article body.'

/** One article as the list shows it. */
interface ArticleSummary {
  id: string
  title: string
  sessionId: string
  status: ArticleStatus
  updatedAt: number
  excerpt: string
}

/** One article as the reader shows it. */
interface ArticleValue {
  id: string
  title: string
  body: string
  sessionId: string
  status: ArticleStatus
  createdAt: number
  updatedAt: number
}

/** Canonical output of `list_articles`. */
interface ArticleListValue {
  articles: ArticleSummary[]
}

/** Canonical output of `get_article`. */
type ArticleGetValue = { article: null } | { article: ArticleValue }

/** The fields every listed article carries. */
const SUMMARY_FIELDS = {
  id: { type: 'string', required: true },
  title: { type: 'string', required: true },
  sessionId: { type: 'string', required: true },
  status: { type: 'string', enum: ARTICLE_STATUSES, required: true },
  updatedAt: { type: 'number', required: true },
  excerpt: { type: 'string', required: true },
} as const

/** The fields one read article carries. */
const ARTICLE_FIELDS = {
  id: { type: 'string', required: true },
  title: { type: 'string', required: true },
  body: { type: 'string', required: true },
  sessionId: { type: 'string', required: true },
  status: { type: 'string', enum: ARTICLE_STATUSES, required: true },
  createdAt: { type: 'number', required: true },
  updatedAt: { type: 'number', required: true },
} as const

const LIST_OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      articles: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: SUMMARY_FIELDS,
        },
      },
    },
  },
  render: (_args: unknown, value: ArticleListValue) => [{ type: 'text' as const, text: JSON.stringify(value) }],
} as const

const GET_OUTPUT = {
  schema: {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          article: { type: 'null', required: true },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          article: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: ARTICLE_FIELDS,
          },
        },
      },
    ],
  },
  render: (_args: unknown, value: ArticleGetValue) => [{ type: 'text' as const, text: JSON.stringify(value) }],
} as const

/** Generic, args-only pending presentation shared by the article tools. */
function present(title: string, kind: 'read' | 'other', rawInput?: unknown): GenericCallView {
  return { card: 'generic', title, kind, ...rawInput === undefined ? {} : { rawInput } }
}

/** The leading characters of an article body. */
function excerptOf(body: string): string {
  const flat = body.replace(/\s+/gu, ' ').trim()
  return flat.length <= EXCERPT_LENGTH ? flat : `${flat.slice(0, EXCERPT_LENGTH)}…`
}

/**
 * Register the two article tools and the section that announces the library.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'tool:articles',
    order: SECTION_ORDER,
    text: [
      '<article_library>',
      'The workbench keeps saved articles in a durable library that every conversation shares.',
      'Call list_articles to see which articles exist, and get_article with an article id to read one.',
      '</article_library>',
    ].join('\n'),
    interpolate: false,
    retirement: 'The article-library tools are no longer available. Their guidance no longer applies.',
  })

  ctx.tools.register(defineTool({
    name: 'list_articles',
    description: LIST_DESCRIPTION,
    parameters: {
      status: {
        type: 'string',
        enum: ARTICLE_STATUSES,
        description: 'Keep only the articles in this publication state; omit to list every article.',
      },
    },
    output: LIST_OUTPUT,
    async execute(args) {
      const status = args.status
      const articles = await ctx.articles.list(status === undefined ? {} : { status })
      return {
        articles: articles.map(article => ({
          id: article.id,
          title: article.title,
          sessionId: article.sessionId,
          status: article.status,
          updatedAt: article.updatedAt,
          excerpt: excerptOf(article.body),
        })),
      }
    },
    presentCall: args => present('List articles', 'read', args.status),
  }))

  ctx.tools.register(defineTool({
    name: 'get_article',
    description: GET_DESCRIPTION,
    parameters: {
      article_id: {
        type: 'string',
        required: true,
        description: 'Exact article id returned by list_articles.',
      },
    },
    output: GET_OUTPUT,
    async execute(args) {
      const article = await ctx.articles.get(args.article_id)
      if (article === undefined) return { article: null }
      return {
        article: {
          id: article.id,
          title: article.title,
          body: article.body,
          sessionId: article.sessionId,
          status: article.status,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        },
      }
    },
    presentCall: args => present('Read article', 'read', args.article_id),
  }))
}
