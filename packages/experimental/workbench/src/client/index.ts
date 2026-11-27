/**
 * 自媒体工作台的浏览器面:注册右侧栏的工作台 tab。
 *
 * 工作台挂在 ui-sidebar-right 的 `sidebar.right.pane.tab` keyed slot 上 —— 该 slot 是
 * session scope,标准 props 直接带 `sessionId` 与 `useProjection`,所以面板读到的就是
 * **当前会话**的草稿。
 *
 * 之所以不做成 `main` 全局面板:主列被 main 面板占据时右侧栏整体隐藏,两者无法共存
 * 同一屏 —— 工作台要「在会话旁边看」,就只能进右侧栏。
 *
 * 注册分两段(与 ui-plan / ui-deliverables 同构):先在 `ctx.sidebarRightTabs` 登记
 * 这个 tab 类型,再把 body 注册到 keyed slot,slot 的 key 必须等于类型的 id。
 *
 * 数据走两条通道:草稿用会话投影(Control Stream 实时推送),文章库用挂载的
 * `articles` Remote。文章库是全局的,所以它的 store 在插件实例上创建一次,由各会话的
 * tab body 共享。
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the slot registry's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls ctx.remote / ctx.uiWorkspace merges.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the sidebar-right's Context merge (ctx.sidebarRight / ctx.sidebarRightTabs).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import remote from '@deepseek-ai/dsh-workbench/remote'
import type { WorkbenchFace } from './WorkbenchTab.tsx'
import { WorkbenchTab } from './WorkbenchTab.tsx'
import { createArticlesStore } from './articles-store.ts'
import { de, en, es, fr, ja, pt, ru, zh, type WorkbenchKey } from './locales.ts'

/** Locale namespace of the workbench surfaces. */
export const NS = 'workbench'

/** Tab type id of the workbench panel; the keyed slot registers under this id. */
export const TAB_ID = '@deepseek-ai/dsh-workbench'

/** Tab kind the workbench panel opens under. */
export const TAB_KIND = 'workbench'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench surface copy. */
    'workbench': WorkbenchKey
  }
}

/** Services required by the workbench client plugin. */
export const inject = ['slots', 'locale', 'remote', 'uiWorkspace', 'sidebarRight', 'sidebarRightTabs']

/**
 * Mount the workbench Remote, then its sidebar-right tab type and body.
 * @param ctx - the browser plugin context.
 * @returns a disposer that removes the Remote when the plugin is torn down.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(remote)
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'workbench: dictionaries')
    // Wait for the mounted `articles` namespace before the tab body reads it.
    const ui = await ctx.inject(['remote.articles', 'slots', 'locale', 'uiWorkspace', 'sidebarRight', 'sidebarRightTabs'], (uiCtx) => {
      const articles = createArticlesStore(uiCtx)

      uiCtx.effect(() => uiCtx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        priority: 'builtin',
        title: () => uiCtx.locale.bind(NS)('tabTitle'),
        guide: [{
          id: TAB_KIND,
          order: 60,
          title: () => uiCtx.locale.bind(NS)('tabTitle'),
          description: () => uiCtx.locale.bind(NS)('tabGuide'),
        }],
      }), 'workbench: sidebar tab type')

      uiCtx.slots.inject('sidebar.right.pane.tab', () => uiCtx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TAB_ID,
        locale: NS,
        inject: (): WorkbenchFace => ({ hooks: { articles } }),
      }, WorkbenchTab))
    })

    return async () => { await ui.dispose(); await disposeRemote() }
  } catch (error: unknown) {
    await disposeRemote()
    throw error
  }
}
