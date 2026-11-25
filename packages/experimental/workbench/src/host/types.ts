/**
 * Public, non-root home of every Remote boundary type the workbench Host exposes.
 *
 * Both halves of this module are free of host-side imports (cordis, dsh-agent,
 * dsh-llm, the services), so the browser half and Typert's boundary analyser
 * can read the exact same types the Host serves. The package's `./types`
 * subpath points here.
 *
 * @module @deepseek-ai/dsh-workbench/host/types
 */

export type {
  ArticleInput,
  ArticleListRequest,
  ArticlePatch,
  ArticleRecord,
  ArticleStatus,
} from './article-domain.ts'
export type * from './draft-types.ts'
