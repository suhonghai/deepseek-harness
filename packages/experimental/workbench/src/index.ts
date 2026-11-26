/**
 * 自媒体工作台插件,宿主面。
 *
 * 宿主侧提供两块持久域:
 * - 「提示词草稿域」——草稿在会话内以事件溯源的方式持久,用户通过 `/draft` 命令
 *   读写。草稿正文始终出现在系统提示词里,所以「再短一点」落在用户刚读过的原文上。
 * - 「文章库」——跨会话共用的成稿存储,落在 base bundle 提供的 storage-domain
 *   (json 后端)里。浏览器用 `articles` Remote 读写;文章记录不进会话日志。
 *
 * 面向模型的两个工具面各自独立成包(`@deepseek-ai/dsh-tool-prompt-draft` 与
 * `@deepseek-ai/dsh-tool-articles`),由 agent preset 引用 —— 工具注册发生在
 * agent scope 内,所以它们必须由 preset 挂载,而不能在这里全局注册。
 */

import type { Context } from '@deepseek-ai/cordis'
import ArticleService from './host/article-service.ts'
import PromptDraftService from './host/draft-service.ts'
import * as draftCommand from './host/draft-command.ts'

export { ArticleService } from './host/article-service.ts'
export { PromptDraftService } from './host/draft-service.ts'
export { DraftError } from './host/draft-runtime.ts'
export type * from './host/article-domain.ts'
export type * from './host/draft-types.ts'

/** Services the workbench host surface requires. */
export const inject = ['agents', 'sessionProjections', 'commands', 'storageDomain']

/**
 * Mount the article library, the prompt-draft domain, and the draft command.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.plugin(ArticleService)
  ctx.plugin(PromptDraftService)
  ctx.plugin({
    name: draftCommand.name,
    inject: draftCommand.inject,
    apply: draftCommand.apply,
  })
}
