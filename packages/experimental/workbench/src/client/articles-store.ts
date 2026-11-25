/**
 * Browser-side read of the durable article library.
 *
 * The Host owns the storage domain; the browser only ever sees the records the
 * `articles` Remote returns. One store per mounted panel: it loads once and
 * reloads when the connection resets (a restarted Host or a new peer), so a
 * page that is not rendered holds no state.
 *
 * @module @deepseek-ai/dsh-workbench/client/articles-store
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ArticleRecord } from '../host/types.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'

/** One article-library snapshot. */
export interface ArticlesState {
  /** Records the Host served, newest update first; null before the first load. */
  readonly records: readonly ArticleRecord[] | null
  /** Diagnostic when the last load failed, or null while healthy. */
  readonly error: string | null
}

/** A snapshot source the renderer binds into a `useArticles` selector hook. */
export type ArticlesObservable = ReturnType<typeof createSnapshotStore<ArticlesState>>

/**
 * Create the article store and wire its refresh triggers.
 * @param ctx - browser plugin context, with the `articles` Remote namespace mounted.
 * @returns the snapshot store to inject into the workbench panel.
 */
export function createArticlesStore(ctx: Context): ArticlesObservable {
  const store = createSnapshotStore<ArticlesState>({ records: null, error: null })
  let generation = 0

  const load = (): void => {
    const current = ++generation
    void ctx.remote.articles.list({}).then((result) => {
      if (current !== generation) return
      store.set(result.ok
        ? { records: result.value, error: null }
        : { records: store.getSnapshot().records, error: `${result.error.code}: ${result.error.message}` })
    }, (error: unknown) => {
      if (current !== generation) return
      store.set({
        records: store.getSnapshot().records,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  load()
  ctx.on('connection/reset', load)
  return store
}
