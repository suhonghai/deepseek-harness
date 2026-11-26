/**
 * Model-facing `get_prompt_draft` and `update_prompt_draft` tools over the
 * persisted same-session prompt draft, plus the system-prompt section that
 * keeps the current draft visible to the model at all times. The draft domain
 * itself belongs to the Host `@deepseek-ai/dsh-workbench` package; mounting
 * this plugin registers the tools in the mounting scope, so a preset decides
 * which agents receive them.
 *
 * @module @deepseek-ai/dsh-tool-prompt-draft
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { brandString } from '@deepseek-ai/dsh-brand'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { DraftId, DraftRef, DraftView } from '@deepseek-ai/dsh-workbench/src/host/draft-types.ts'
// Type-only: pulls the Context merge that declares `ctx.promptDrafts`.
import type {} from '@deepseek-ai/dsh-workbench/src/host/draft-service.ts'

/** The prompt-draft tool plugin. */
export const name = 'tool-prompt-draft'

/** Services the prompt-draft tools require. */
export const inject = ['agents', 'promptDrafts', 'tools', 'systemPrompt']

const GET_DESCRIPTION =
  'Read the current session prompt draft — the article-generation prompt you and the user are '
  + 'refining together. Returns its id and revision, which update_prompt_draft requires.'

const UPDATE_DESCRIPTION =
  'Rewrite the current session prompt draft. The user is refining one article-generation prompt '
  + 'with you, so edit it whenever their feedback changes it. Pass the id and revision that '
  + 'get_prompt_draft returned; omit both only when no draft exists yet.'

/** Canonical prompt-draft tool output. */
type DraftToolValue =
  | { draft: null }
  | {
    draft: {
      id: string
      revision: number
      title: string
      body: string
      createdAt: number
      updatedAt: number
    }
  }

const DRAFT_VALUE_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        draft: { type: 'null', required: true },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        draft: {
          type: 'object',
          additionalProperties: false,
          required: true,
          properties: {
            id: { type: 'string', required: true },
            revision: { type: 'number', required: true },
            title: { type: 'string', required: true },
            body: { type: 'string', required: true },
            createdAt: { type: 'number', required: true },
            updatedAt: { type: 'number', required: true },
          },
        },
      },
    },
  ],
} as const

/** Reusable canonical output declaration for both prompt-draft tools. */
const DRAFT_OUTPUT = {
  schema: DRAFT_VALUE_SCHEMA,
  render: (_args: unknown, value: DraftToolValue) => [{ type: 'text' as const, text: JSON.stringify(value) }],
}

/** Generic, args-only pending presentation shared by the prompt-draft tools. */
function present(title: string, kind: 'read' | 'other', rawInput?: unknown): GenericCallView {
  return { card: 'generic', title, kind, ...rawInput === undefined ? {} : { rawInput } }
}

/** Stable compact model result. */
function draftValue(draft: DraftView | undefined): DraftToolValue {
  if (draft === undefined) return { draft: null }
  return {
    draft: {
      id: draft.id,
      revision: draft.revision,
      title: draft.title,
      body: draft.body,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    },
  }
}

/** The calling agent plus the identity checks the tools require. */
export interface DraftToolExecution {
  readonly agent: Agent
}

/**
 * Resolve and authenticate the calling agent.
 * @param ctx - Context carrying the live agent registry.
 * @param exec - Tool execution metadata supplied by the registry.
 * @returns The authenticated calling agent.
 */
export function draftToolExecution(ctx: Context, exec: ToolRunContext): DraftToolExecution {
  const agent = exec.agent
  if (agent === undefined) {
    throw new HarnessError('prompt-draft tools require a calling agent', 'DRAFT_TOOL_AGENT_REQUIRED')
  }
  if (ctx.agents.get(agent.id) !== agent || agent.status !== 'running'
    || ctx.agents.currentInitiator() !== agent) {
    throw new HarnessError(
      'prompt-draft tools require the exact live calling agent inside its active driver',
      'DRAFT_TOOL_AGENT_REQUIRED',
    )
  }
  return { agent }
}

/**
 * Build the exact compare-and-set ref from model arguments.
 * @param draftIdValue - raw draft identifier from the model.
 * @param revision - raw revision from the model.
 * @returns The branded compare-and-set ref.
 */
function draftRef(draftIdValue: string, revision: number): DraftRef {
  if (draftIdValue.length === 0 || draftIdValue !== draftIdValue.trim()
    || !Number.isSafeInteger(revision) || revision < 1) {
    throw new HarnessError(
      'draft_id must be non-empty and revision must be a positive safe integer',
      'DRAFT_TOOL_INVALID_UPDATE',
    )
  }
  return { id: brandString<DraftId>(draftIdValue), revision }
}

/**
 * Render the current draft for one assembly. The draft stays visible to the
 * model in every turn, so a follow-up instruction lands on the text the user
 * just read rather than on a summary of it.
 * @param ctx - the host plugin context.
 * @param context - the assembly context carrying the receiving session.
 * @returns the draft block, or an empty string when no draft is current.
 */
function renderDraftSection(ctx: Context, context: AssembleContext): string {
  const session = context.session
  if (session === undefined) return ''
  const draft = ctx.promptDrafts.draftOf(session)
  if (draft === undefined) return ''
  return [
    '<prompt_draft>',
    `id: ${draft.id}`,
    `revision: ${draft.revision}`,
    `title: ${draft.title}`,
    '',
    draft.body,
    '</prompt_draft>',
  ].join('\n')
}

/**
 * Register the two prompt-draft tools and the section that keeps the current
 * draft visible.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'tool:prompt-draft',
    order: ctx.systemPrompt.getSectionOrder('TOOL_PROMPT_DRAFT'),
    text: context => renderDraftSection(ctx, context),
    interpolate: false,
    retirement: 'The prompt-draft tools are no longer available. Their guidance no longer applies.',
  })

  ctx.tools.register(defineTool({
    name: 'get_prompt_draft',
    description: GET_DESCRIPTION,
    parameters: {},
    output: DRAFT_OUTPUT,
    execute(_args, exec) {
      const execution = draftToolExecution(ctx, exec)
      return Promise.resolve(draftValue(ctx.promptDrafts.get(execution.agent)))
    },
    presentCall: () => present('Read current prompt draft', 'read'),
  }))

  ctx.tools.register(defineTool({
    name: 'update_prompt_draft',
    description: UPDATE_DESCRIPTION,
    parameters: {
      draft_id: {
        type: 'string',
        description: 'Exact draft id returned by get_prompt_draft; omit only when no draft exists yet.',
      },
      revision: {
        type: 'number',
        description: 'Exact positive revision returned by get_prompt_draft; omit only when no draft exists yet.',
      },
      title: { type: 'string', description: 'Replacement draft label.' },
      body: { type: 'string', description: 'Replacement article-generation prompt.' },
    },
    output: DRAFT_OUTPUT,
    execute(args, exec) {
      const execution = draftToolExecution(ctx, exec)
      const current = ctx.promptDrafts.get(execution.agent)
      if (current === undefined) {
        if (args.draft_id !== undefined || args.revision !== undefined) {
          throw new HarnessError(
            'no prompt draft exists yet; omit draft_id and revision to create one',
            'DRAFT_TOOL_INVALID_UPDATE',
          )
        }
        if (args.body === undefined) {
          throw new HarnessError('a new prompt draft requires a body', 'DRAFT_TOOL_INVALID_UPDATE')
        }
        const created = ctx.promptDrafts.create(execution.agent, {
          ...args.title === undefined ? {} : { title: args.title },
          body: args.body,
        })
        return Promise.resolve(draftValue(created))
      }
      if (args.draft_id === undefined || args.revision === undefined) {
        throw new HarnessError(
          'updating a prompt draft requires the draft_id and revision returned by get_prompt_draft',
          'DRAFT_TOOL_INVALID_UPDATE',
        )
      }
      const updated = ctx.promptDrafts.update(execution.agent, draftRef(args.draft_id, args.revision), {
        ...args.title === undefined ? {} : { title: args.title },
        ...args.body === undefined ? {} : { body: args.body },
      })
      return Promise.resolve(draftValue(updated))
    },
    presentCall: args => present('Update prompt draft', 'other', args.body ?? args.title),
  }))
}
