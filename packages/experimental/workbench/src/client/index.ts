/**
 * 自媒体工作台的浏览器面:注册工作台主面板与左侧栏入口。
 *
 * 面板挂在 ui-layout 的 `main` keyed slot 上,左侧栏图标挂在 `sidebar.panellist`
 * list slot 上 —— 与官方插件管理页(Plugins)走同一条路,所以侧栏的选中态、面板切换
 * 行为都由 ui-layout / ui-sidebar 负责,这里只提供内容。
 *
 * 数据走两条通道:草稿用会话投影(Control Stream 实时推送),文章库用挂载的
 * `articles` Remote。面板是全局面板,不绑定单个会话。
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import remote from '@deepseek-ai/dsh-workbench/remote'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the slot registry's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the sidebar's SlotMap merge (the 'sidebar.panellist' entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls ctx.remote / ctx.uiWorkspace / ctx.sessions merges.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkbenchFace } from './WorkbenchPage.tsx'
import { WorkbenchPage } from './WorkbenchPage.tsx'
import { WorkbenchPanelIcon } from './WorkbenchPanelIcon.tsx'
import { createArticlesStore } from './articles-store.ts'
import { de, en, es, fr, ja, pt, ru, zh, type WorkbenchKey } from './locales.ts'

/** Locale namespace of the workbench surfaces. */
export const NS = 'workbench'

/** Main panel id of the workbench panel. */
export const PANEL_ID = 'workbench' as MainPanelId

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench surface copy. */
    'workbench': WorkbenchKey
  }
}

/** Services required by the workbench client plugin. */
export const inject = ['slots', 'locale', 'layout', 'remote', 'uiWorkspace']

/**
 * Mount the workbench Remote, then its panel and sidebar entry.
 * @param ctx - the browser plugin context.
 * @returns a disposer that removes the Remote when the plugin is torn down.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(remote)
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'workbench: dictionaries')
    // Wait for the mounted `articles` namespace before the panel's store reads it.
    const ui = await ctx.inject(['remote.articles', 'slots', 'locale', 'uiWorkspace'], (uiCtx) => {
      const articles = createArticlesStore(uiCtx)

      uiCtx.slots.inject('main', function* () {
        yield uiCtx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: (): WorkbenchFace => ({
            hooks: { articles },
            openChat: (sessionId: SessionId) => { uiCtx.uiWorkspace.openSession(sessionId) },
          }),
        }, WorkbenchPage)
      })

      uiCtx.slots.inject('sidebar.panellist', () => uiCtx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 5,
        locale: NS,
        label: () => uiCtx.locale.bind(NS)('nav'),
      }, WorkbenchPanelIcon))
    })

    return async () => { await ui.dispose(); await disposeRemote() }
  } catch (error: unknown) {
    await disposeRemote()
    throw error
  }
}
