/**
 * 自媒体工作台插件,宿主面。
 *
 * 宿主侧提供「提示词草稿域」:草稿在会话内以事件溯源的方式持久,模型通过
 * `get_prompt_draft` / `update_prompt_draft` 两个工具读写它,用户通过 `/draft`
 * 命令查看与直接改写。草稿正文始终出现在系统提示词里,所以用户随口一句
 * 「再短一点」落在用户刚读过的那份文本上。
 */

import type { Context } from '@deepseek-ai/cordis'
import PromptDraftService from './host/draft-service.ts'
import * as draftTools from './host/draft-tools.ts'
import * as draftCommand from './host/draft-command.ts'

export { PromptDraftService } from './host/draft-service.ts'
export { DraftError } from './host/draft-runtime.ts'
export type * from './host/draft-types.ts'

/** Services the workbench host surface requires. */
export const inject = ['agents', 'sessionProjections', 'tools', 'systemPrompt', 'commands']

/**
 * Mount the prompt-draft domain, its model tools, and the human command.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: Context): void {
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
