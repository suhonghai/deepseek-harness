/**
 * 自媒体工作台主面板。
 *
 * 四块面的框架:生成提示词、文章、素材、发布。生成提示词与文章接真实数据 ——
 * 前者从会话投影读当前草稿,后者从 article Remote 读文章库;素材与发布仍是占位。
 */

import type { ReactNode } from 'react'
import type { DraftProjection } from '../host/types.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ArticlesObservable } from './articles-store.ts'
import css from './WorkbenchPage.module.css'

/** The panel's own injected face: one article-library snapshot and the chat opener. */
export interface WorkbenchFace {
  readonly hooks: {
    readonly articles: ArticlesObservable
  }
  /** Leave the workbench and return to the named Session's conversation. */
  readonly openChat: (sessionId: SessionId) => void
}

/** Full component props assembled by the main slot renderer. */
export type WorkbenchPageProps =
  PropsRuntime<'main'>
  & PropsLocale<'workbench'>
  & InjectFace<WorkbenchFace>

/** A Session carrying the most recently updated live draft. */
interface DraftEntry {
  readonly sessionId: SessionId
  readonly draft: NonNullable<DraftProjection['draft']>
  readonly updatedAt: number
}

/**
 * Pick the live draft to show: among all held Sessions, the one whose current
 * draft carries the newest mutation. `promptDraft` is a summary projection, so
 * the value is already in the session list store; no extra Remote read is needed.
 * @param props - the runtime hooks carrying the session list.
 * @returns the newest live draft, or null when no Session has one.
 */
function useCurrentDraft({ useSessions }: WorkbenchPageProps): DraftEntry | null {
  const projections = useSessions(state => state.projectionsBySession)
  const byId = useSessions(state => state.byId)
  let best: DraftEntry | null = null
  for (const sessionId of Object.keys(projections) as SessionId[]) {
    const value = projections[sessionId]?.values.promptDraft
    const draft = value?.draft
    if (draft === null || draft === undefined) continue
    const updatedAt = Math.max(value?.updatedAt ?? 0, byId[sessionId]?.updatedAt ?? 0)
    if (best === null || updatedAt > best.updatedAt) best = { sessionId, draft, updatedAt }
  }
  return best
}

/** Format an epoch-millisecond timestamp with the browser's locale. */
function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}

/**
 * Render the workbench overview with live prompt-draft and article-library data.
 * @param props - the main slot's runtime props, workbench dictionary, and injected face.
 * @returns the panel element.
 */
export function WorkbenchPage(props: WorkbenchPageProps): ReactNode {
  const { t, useArticles, openChat } = props
  const current = useCurrentDraft(props)
  const articles = useArticles(state => state)

  return (
    <div className={css.page}>
      <header className={css.header}>
        <h1 className={css.title}>{t('title')}</h1>
        <p className={css.intro}>{t('intro')}</p>
      </header>
      <div className={css.grid}>
        <section className={`${css.card} ${css.cardWide}`}>
          <h2 className={css.cardTitle}>{t('sectionPrompt')}</h2>
          <p className={css.cardHint}>{t('sectionPromptHint')}</p>
          {current === null ? (
            <div className={css.empty}>
              <span>{t('draftNone')}</span>
              <span className={css.emptyHint}>{t('draftNoneHint')}</span>
            </div>
          ) : (
            <div className={css.draft}>
              <div className={css.draftHead}>
                <strong className={css.draftTitle}>{current.draft.title}</strong>
                <span className={css.badge}>
                  {t('draftRevision')} {current.draft.revision}
                </span>
              </div>
              <pre className={css.draftBody}>{current.draft.body}</pre>
              <div className={css.draftMeta}>
                <span>{t('draftUpdated')} {formatTime(current.updatedAt)}</span>
                <span>{current.draft.revision - 1} {t('draftVersions')}</span>
              </div>
              <button type="button" className={css.action} onClick={() => { openChat(current.sessionId) }}>
                {t('continueInChat')}
              </button>
            </div>
          )}
        </section>

        <section className={css.card}>
          <h2 className={css.cardTitle}>{t('sectionArticles')}</h2>
          <p className={css.cardHint}>{t('sectionArticlesHint')}</p>
          {articles.error !== null ? (
            <div className={css.empty}><span className={css.error}>{t('loadError')}: {articles.error}</span></div>
          ) : articles.records === null ? (
            <div className={css.empty}><span>{t('loading')}</span></div>
          ) : articles.records.length === 0 ? (
            <div className={css.empty}>
              <span>{t('articlesEmpty')}</span>
              <span className={css.emptyHint}>{t('articlesEmptyHint')}</span>
            </div>
          ) : (
            <ul className={css.articleList}>
              {articles.records.slice(0, 12).map(article => (
                <li key={article.id} className={css.articleRow}>
                  <span className={css.articleTitle}>{article.title}</span>
                  <span className={`${css.badge} ${css[article.status] ?? ''}`}>{t(articleStatusKey(article.status))}</span>
                  <span className={css.articleTime}>{formatTime(article.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(['sectionAssets', 'sectionPublish'] as const).map(key => (
          <section key={key} className={css.card}>
            <h2 className={css.cardTitle}>{t(key)}</h2>
            <p className={css.cardHint}>{t(`${key}Hint`)}</p>
            <span className={css.badge}>{t('statusPlanned')}</span>
          </section>
        ))}
      </div>
    </div>
  )
}

/**
 * Map a stored publication state to its dictionary key.
 * @param status - the article's durable status.
 * @returns the locale key for that status.
 */
function articleStatusKey(status: string): 'articleStatusDraft' | 'articleStatusReady' | 'articleStatusPublished' {
  return status === 'published' ? 'articleStatusPublished' : status === 'ready' ? 'articleStatusReady' : 'articleStatusDraft'
}
