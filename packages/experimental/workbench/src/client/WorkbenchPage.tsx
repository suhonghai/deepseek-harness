/**
 * 自媒体工作台主面板。
 *
 * 这一版只搭出四个产品面的骨架:生成提示词、文章、素材、发布。每一块都还没有
 * 行为 —— 提示词草稿域与文章库接入后,这里换成真实的视图。
 */

import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './WorkbenchPage.module.css'

/** Full component props assembled by the main slot renderer. */
export type WorkbenchPageProps =
  PropsRuntime<'main'>
  & PropsLocale<'workbench'>

/**
 * Render the workbench overview.
 * @param props - the main slot's runtime props and the workbench dictionary.
 * @returns the panel element.
 */
export function WorkbenchPage({ t }: WorkbenchPageProps): ReactNode {
  const sections = [
    { title: t('sectionPrompt'), hint: t('sectionPromptHint') },
    { title: t('sectionArticles'), hint: t('sectionArticlesHint') },
    { title: t('sectionAssets'), hint: t('sectionAssetsHint') },
    { title: t('sectionPublish'), hint: t('sectionPublishHint') },
  ]
  return (
    <div className={css.page}>
      <header className={css.header}>
        <h1 className={css.title}>{t('title')}</h1>
        <p className={css.intro}>{t('intro')}</p>
      </header>
      <div className={css.grid}>
        {sections.map(section => (
          <section key={section.title} className={css.card}>
            <h2 className={css.cardTitle}>{section.title}</h2>
            <p className={css.cardHint}>{section.hint}</p>
            <span className={css.badge}>{t('statusPlanned')}</span>
          </section>
        ))}
      </div>
    </div>
  )
}
