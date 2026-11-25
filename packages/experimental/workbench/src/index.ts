/**
 * 自媒体工作台插件,宿主面。
 *
 * 宿主侧提供两块持久域:
 * - 「提示词草稿域」——草稿在会话内以事件溯源的方式持久,模型通过
 *   `get_prompt_draft` / `update_prompt_draft` 读写,用户通过 `/draft` 命令改写。
 *   草稿正文始终出现在系统提示词里,所以「再短一点」落在用户刚读过的原文上。
 * - 「文章库」——跨会话共用的成稿存储,落在 base bundle 提供的 storage-domain
 *   (json 后端)里。模型用 `list_articles` / `get_article` 读,浏览器用 `articles`
 *   Remote 读写;文章记录不进会话日志。
 */

import type { Context } from '@deepseek-ai/cordis'
import ArticleService from './host/article-service.ts'
import * as articleTools from './host/article-tools.ts'
import PromptDraftService from './host/draft-service.ts'
import * as draftTools from './host/draft-tools.ts'
import * as draftCommand from './host/draft-command.ts'

export { ArticleService } from './host/article-service.ts'
export { PromptDraftService } from './host/draft-service.ts'
export { DraftError } from './host/draft-runtime.ts'
export type * from './host/article-domain.ts'
export type * from './host/draft-types.ts'

/** Services the workbench host surface requires. */
export const inject = ['agents', 'sessionProjections', 'tools', 'systemPrompt', 'commands', 'storageDomain']

/**
 * Mount the article library, the prompt-draft domain, their model tools, and the draft command.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.plugin(ArticleService)
  ctx.plugin({
    name: articleTools.name,
    inject: articleTools.inject,
    apply: articleTools.apply,
  })
  ctx.plugin(PromptDraftService)
  ctx.plugin({
    name: draftTools.name,
    inject: draftTools.inject,
    apply: draftTools.apply,
  })
  ctx.plugin({
    name: draftCommand.name,
    inject: draftCommand.inject,
    apply: draftCommand.apply,
  })
}
