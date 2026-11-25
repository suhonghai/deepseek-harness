/** Test-only Loader plugin that creates a prompt draft at the first real step edge. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-workbench'

export const name = 'seed-draft'
export const inject = ['promptDrafts']

export function apply(ctx: Context): void {
  ctx.on('agent/pre-step', ({ agent }, next) => {
    if (ctx.promptDrafts.get(agent) === undefined) {
      ctx.promptDrafts.create(agent, {
        title: 'Prove the composed draft survives in the session log',
        body: 'Prove the composed draft survives in the session log',
      })
    }
    return next()
  })
}
