/**
 * 自媒体工作台的浏览器面:注册工作台主面板与左侧栏入口。
 *
 * 面板挂在 ui-layout 的 `main` keyed slot 上,左侧栏图标挂在 `sidebar.panellist`
 * list slot 上 —— 与官方插件管理页(Plugins)走同一条路,所以侧栏的选中态、面板切换
 * 行为都由 ui-layout / ui-sidebar 负责,这里只提供内容。
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the slot registry's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the sidebar's SlotMap merge (the 'sidebar.panellist' entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { WorkbenchPage } from './WorkbenchPage.tsx'
import { WorkbenchPanelIcon } from './WorkbenchPanelIcon.tsx'
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
export const inject = ['slots', 'locale', 'layout']

/**
 * Mount the workbench panel and its sidebar entry.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'workbench: dictionaries')

  ctx.slots.inject('main', function* () {
    yield ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: NS,
    }, WorkbenchPage)
  })

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 5,
    locale: NS,
    label: () => ctx.locale.bind(NS)('nav'),
  }, WorkbenchPanelIcon))
}
