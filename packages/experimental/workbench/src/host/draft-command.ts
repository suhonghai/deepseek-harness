/**
 * Human-facing `/draft` command over the persisted same-session prompt draft.
 *
 * @module @deepseek-ai/dsh-workbench/host/draft-command
 */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { CommandDefinitionId } from '@deepseek-ai/dsh-commands/types'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { DraftError } from './draft-runtime.ts'
import type { DraftRef, DraftView } from './draft-types.ts'
// Type-only: pulls the Context merge that declares `ctx.promptDrafts`.
import type {} from './draft-service.ts'

/** The prompt-draft command plugin. */
export const name = 'command-prompt-draft'

/** Services the prompt-draft command requires. */
export const inject = ['commands', 'promptDrafts']

const USAGE = 'Usage: /draft [<prompt text>|clear]'

/** Commands that are meaningful from one exact live state. */
type DraftCommand =
  | { readonly kind: 'show' }
  | { readonly kind: 'clear' }
  | { readonly kind: 'set'; readonly body: string }

/** Parse only the grammar owned by `/draft`. */
function parseDraftCommand(rawInput: string): DraftCommand {
  const input = rawInput.trim()
  if (input.length === 0) return { kind: 'show' }
  if (input.toLowerCase() === 'clear') return { kind: 'clear' }
  return { kind: 'set', body: input }
}

/** Exact current compare-and-set ref. */
function draftRef(draft: DraftView): DraftRef {
  return { id: draft.id, revision: draft.revision }
}

/** Render direct UI output without exposing compare-and-set internals. */
function renderDraft(title: string, draft: DraftView): CommandResult {
  return {
    kind: 'success',
    text: [
      `${title} (v${draft.revision})`,
      `Title: ${draft.title}`,
      '',
      draft.body,
      '',
      'Commands: /draft <prompt text>, /draft clear',
    ].join('\n'),
  }
}

/**
 * Submit the invocation's admitted composer attachments as one model-visible
 * user message ahead of the draft edit they accompany.
 * @param invocation - the dispatched command invocation.
 */
function submitDraftAttachments(invocation: CommandInvocation): void {
  if (invocation.attachments.length === 0) return
  invocation.agent.followup(createUserMessage({
    content: [
      ...invocation.attachments,
      { type: 'text', text: 'Reference attachments for the prompt draft.' },
    ],
    source: { kind: 'user' },
  }))
}

/**
 * Execute one parsed human command through the domain that owns persistence.
 * @param ctx - the host plugin context.
 * @param invocation - the dispatched command invocation.
 * @returns the command result shown to the user.
 */
function executeDraftCommand(ctx: Context, invocation: CommandInvocation): CommandResult {
  const command = parseDraftCommand(invocation.rawInput)
  try {
    const current = ctx.promptDrafts.get(invocation.agent)
    switch (command.kind) {
      case 'show':
        return current === undefined
          ? { kind: 'success', text: `No prompt draft is currently set.\n${USAGE}` }
          : renderDraft('Prompt draft', current)
      case 'clear':
        if (current === undefined) return { kind: 'success', text: 'No prompt draft to clear.' }
        ctx.promptDrafts.clear(invocation.agent, draftRef(current))
        return { kind: 'success', text: 'Prompt draft cleared.' }
      case 'set': {
        const updated = current === undefined
          ? ctx.promptDrafts.create(invocation.agent, { body: command.body })
          : ctx.promptDrafts.update(invocation.agent, draftRef(current), { body: command.body })
        submitDraftAttachments(invocation)
        return renderDraft(current === undefined ? 'Prompt draft created' : 'Prompt draft updated', updated)
      }
      /* v8 ignore next 2 -- DraftCommand is closed and every member is handled above */
      default: {
        const exhaustive: never = command
        throw new TypeError(`unknown draft command: ${String(exhaustive)}`)
      }
    }
  } catch (error: unknown) {
    // Corrupt draft state is not a command-shape problem; the command runtime reports its cause.
    if (error instanceof DraftError && error.code !== 'DRAFT_STATE_CORRUPT') {
      return {
        kind: 'error',
        text: 'The prompt draft command is not valid for the current state. Run /draft to view available commands.',
      }
    }
    throw error
  }
}

/**
 * Register the `/draft` command for every composed command adapter.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.commands.register({
    definitionId: brandString<CommandDefinitionId>('@deepseek-ai/dsh-command-prompt-draft'),
    name: 'draft',
    description: 'Show, set, or clear the article-generation prompt draft',
    input: { hint: '[<prompt text>|clear]', attachments: true },
    handler: invocation => executeDraftCommand(ctx, invocation),
  })
}
