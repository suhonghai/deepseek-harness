/**
 * The model-facing prompt-draft tools: registration, the read call, and the
 * compare-and-set write path over the real Host draft domain.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import { createScope } from '@deepseek-ai/dsh-scope'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { unsupportedModel, unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import PromptDraftService from '@deepseek-ai/dsh-workbench/src/host/draft-service.ts'
import * as promptDraftTools from '../src/index.ts'

interface Bench {
  ctx: Context
  agent: Agent
}

/** Register a minimal registry-compatible live agent over a store session. */
async function liveAgent(ctx: Context): Promise<Agent> {
  const status: AgentStatus = 'running'
  const session = ctx.sessions.create()
  const agent: Agent = {
    id: session.id,
    options: {},
    session,
    model: unsupportedModel(),
    inbox: unsupportedInbox(),
    ctx,
    get status() { return status },
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => { throw new Error('prompt-draft tool tests do not inject model context') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle() { return Promise.resolve() },
  }
  await ctx.agents.register(agent)
  return agent
}

/** Boot the draft domain and the model-facing tools under one Agent scope. */
async function harness(): Promise<Bench> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(PromptDraftService)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  const agent = await liveAgent(ctx)
  const scope = createScope(ctx, agent)
  await scope.ctx.plugin(promptDraftTools)
  await ctx.fiber.await()
  return { ctx, agent }
}

/** Run one tool call as the live calling agent. */
async function call(bench: Bench, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await bench.ctx.agents.withInitiator(bench.agent, () => executeToolFixture(bench.ctx, {
    callId: brandString<ToolCallId>('draft-call'),
    signal: new AbortController().signal,
    name,
    arguments: args,
    agent: bench.agent,
  }))
  if (result.isError) throw result.error
  return result.content
}

/** The JSON text block a tool result carries. */
function text(content: unknown): unknown {
  const block = (content as { text: string }[])[0]
  return JSON.parse(block?.text ?? '')
}

describe('prompt-draft model tools', () => {
  it('registers both tools', async () => {
    const bench = await harness()
    expect(bench.ctx.tools.get('get_prompt_draft', bench.agent)).toBeDefined()
    expect(bench.ctx.tools.get('update_prompt_draft', bench.agent)).toBeDefined()
  })

  it('reports no draft before one exists', async () => {
    const bench = await harness()
    expect(text(await call(bench, 'get_prompt_draft', {}))).toEqual({ draft: null })
  })

  it('creates a draft and reads it back', async () => {
    const bench = await harness()
    expect(text(await call(bench, 'update_prompt_draft', { title: 'Essay', body: 'Write an essay.' }))).toMatchObject({
      draft: { revision: 1, title: 'Essay', body: 'Write an essay.' },
    })
    expect(text(await call(bench, 'get_prompt_draft', {}))).toMatchObject({
      draft: { title: 'Essay', body: 'Write an essay.' },
    })
  })

  it('refuses to create a draft with a compare-and-set reference', async () => {
    const bench = await harness()
    await expect(call(bench, 'update_prompt_draft', { body: 'x', draft_id: 'draft-1', revision: 1 }))
      .rejects.toThrow(expect.objectContaining({ info: expect.objectContaining({ code: 'DRAFT_TOOL_INVALID_UPDATE' }) }))
  })

  it('refuses to update a draft that does not exist yet', async () => {
    const bench = await harness()
    await expect(call(bench, 'update_prompt_draft', { title: 'x' }))
      .rejects.toThrow(expect.objectContaining({ info: expect.objectContaining({ code: 'DRAFT_TOOL_INVALID_UPDATE' }) }))
  })

  it('refuses a stale revision', async () => {
    const bench = await harness()
    await call(bench, 'update_prompt_draft', { body: 'first' })
    await expect(call(bench, 'update_prompt_draft', { body: 'second', draft_id: 'draft-x', revision: 1 }))
      .rejects.toThrow(expect.objectContaining({ info: expect.objectContaining({ code: 'DRAFT_STALE_REVISION' }) }))
  })

  it('rejects a call without a live calling agent', async () => {
    const bench = await harness()
    await expect(bench.ctx.agents.withoutInitiator(async () => {
      const result = await executeToolFixture(bench.ctx, {
        callId: brandString<ToolCallId>('anonymous-call'),
        signal: new AbortController().signal,
        name: 'get_prompt_draft',
        arguments: {},
        agent: bench.agent,
      })
      if (result.isError) throw result.error
      return result.content
    })).rejects.toThrow(expect.objectContaining({
      info: expect.objectContaining({ code: 'DRAFT_TOOL_AGENT_REQUIRED' }),
    }))
  })
})
