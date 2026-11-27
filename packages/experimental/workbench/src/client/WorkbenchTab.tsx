/**
 * 自媒体工作台的右侧栏 tab。
 *
 * 挂在 ui-sidebar-right 的 `sidebar.right.pane.tab` keyed slot 上 —— 该 slot 是
 * session scope,标准 props 直接带 `sessionId` 与 `useProjection`,所以这里读到的
 * 就是**当前会话**的草稿,不必再遍历所有会话挑最新的那份。
 *
 * 四块面的框架:生成提示词、文章、素材、发布。生成提示词与文章接真实数据 ——
 * 前者从会话投影读当前草稿,后者从 article Remote 读文章库;素材与发布仍是占位。
 */

import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ArticlesObservable } from './articles-store.ts'
import css from './WorkbenchTab.module.css'

/** The tab's own injected face: one article-library snapshot and the chat opener. */
export interface WorkbenchFace {
  readonly hooks: {
    readonly articles: ArticlesObservable
  }
  /** Leave the workbench and return to the named Session's conversation. */
  readonly openChat: (sessionId: SessionId) => void
}

/** Full component props assembled by the sidebar-right tab renderer. */
export type WorkbenchTabProps =
  PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<'workbench'>
  & InjectFace<WorkbenchFace>

/** Format an epoch-millisecond timestamp with the browser's locale. */
function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}

/**
 * Render the workbench panel with this Session's live prompt draft and the article library.
 * @param props - the tab slot's runtime props, workbench dictionary, and injected face.
 * @returns the tab body element.
 */
export function WorkbenchTab(props: WorkbenchTabProps): ReactNode {
  const { t, useArticles, useProjection, openChat, sessionId } = props
  const projection = useProjection('promptDraft')
  const draft = projection?.draft ?? null
  const articles = useArticles(state => state)

  return (
    <div className={css.page}>
      <header className={css.header}>
        <h1 className={css.title}>{t('title')}</h1>
        <p className={css.intro}>{t('intro')}</p>
      </header>

      <section className={css.card}>
        <h2 className={css.cardTitle}>{t('sectionPrompt')}</h2>
        <p className={css.cardHint}>{t('sectionPromptHint')}</p>
        {draft === null ? (
          <div className={css.empty}>
            <span>{t('draftNone')}</span>
            <span className={css.emptyHint}>{t('draftNoneHint')}</span>
          </div>
        ) : (
          <div className={css.draft}>
            <div className={css.draftHead}>
              <strong className={css.draftTitle}>{draft.title}</strong>
              <span className={css.badge}>
                {t('draftRevision')} {draft.revision}
              </span>
            </div>
            <pre className={css.draftBody}>{draft.body}</pre>
            <div className={css.draftMeta}>
              <span>{t('draftUpdated')} {formatTime(projection?.updatedAt ?? 0)}</span>
              <span>{draft.revision - 1} {t('draftVersions')}</span>
            </div>
            <button type="button" className={css.action} onClick={() => { openChat(sessionId) }}>
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
