/**
 * The `promptDraft` projection unit: mounting PromptDraftService beside the
 * registry serves the current whole draft plus its superseded revisions;
 * before the first create the draft is null; a clear tombstone returns it to
 * null; a composition without the draft service has no `promptDraft` key;
 * unmounting drops it (HMR safety). The host state retains strict replay
 * failures without throwing from the registry drive, and PromptDraftService
 * rejects access after such a failure.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { brandString } from '@deepseek-ai/dsh-brand'
import { unsupportedModel, unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import PromptDraftService, {
  applyDraftProjection,
  createDraftProjectionDefinition,
  foldDraft,
} from '../src/host/draft-service.ts'
import type { DraftId, DraftProjectionState } from '../src/host/draft-types.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'test': { kind: 'test' } & ContextFormed
  }
}

interface Bench {
  ctx: Context
  session: Session
  agent: Agent
  tailValues(): Record<string, unknown>
}

/** Register a minimal registry-compatible live agent over a store session. */
async function liveAgent(ctx: Context, session: Session): Promise<Agent> {
  const status: AgentStatus = 'idle'
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
    inject: () => { throw new Error('draft projection tests do not inject model context') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle() { return Promise.resolve() },
  }
  await ctx.agents.register(agent)
  return agent
}

/** Build a context carrying the session store, the projection registry, and optionally the draft domain. */
async function harness(withDraft: boolean): Promise<Bench> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  if (withDraft) await ctx.plugin(PromptDraftService)
  const session = ctx.sessions.create()
  const agent = await liveAgent(ctx, session)
  return {
    ctx,
    session,
    agent,
    tailValues: () => ctx.sessionProjections.snapshot(session).values,
  }
}

/** One paginable message so the tail is non-degenerate. */
function seedMessage(session: Session): void {
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'hi' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
}

describe('prompt-draft projection unit', () => {
  it('serves an empty draft before the first create', async () => {
    const bench = await harness(true)
    seedMessage(bench.session)
    expect(bench.tailValues()['promptDraft']).toMatchObject({ draft: null, versions: [] })
  })

  it('serves the whole current draft after create and tracks mutations last-wins', async () => {
    const bench = await harness(true)
    seedMessage(bench.session)
    const created = bench.ctx.promptDrafts.create(bench.agent, {
      title: 'Essay',
      body: 'ship the draft bar',
    })
    expect(bench.tailValues()['promptDraft']).toMatchObject({
      draft: { id: created.id, revision: 1, title: 'Essay', body: 'ship the draft bar' },
    })
    const updated = bench.ctx.promptDrafts.update(bench.agent, created, { body: 'ship the draft baz' })
    expect(bench.tailValues()['promptDraft']).toMatchObject({
      draft: { revision: updated.revision, body: 'ship the draft baz' },
    })
  })

  it('returns the draft to null after a clear tombstone and keeps the history', async () => {
    const bench = await harness(true)
    const created = bench.ctx.promptDrafts.create(bench.agent, { body: 'temporary' })
    bench.ctx.promptDrafts.update(bench.agent, created, { body: 'revised' })
    bench.ctx.promptDrafts.clear(bench.agent, bench.ctx.promptDrafts.get(bench.agent) as never)
    expect(bench.tailValues()['promptDraft']).toMatchObject({
      draft: null,
      versions: [{ revision: 1, body: 'temporary' }],
    })
  })

  it('does not let inbox changes revive a cleared draft', async () => {
    const bench = await harness(true)
    const created = bench.ctx.promptDrafts.create(bench.agent, { body: 'stay cleared' })
    bench.ctx.promptDrafts.clear(bench.agent, created)
    bench.session.append('agent/inbox/spliced', {
      target: 'next-step',
      start: 0,
      inserted: [createUserMessage({
        content: [{ type: 'text', text: 'unrelated pending context' }],
        source: { kind: 'test' },
      })],
    })
    expect(bench.tailValues()['promptDraft']).toMatchObject({ draft: null })
    expect(foldDraft(bench.session.snapshotEvents(), 20).current).toBeUndefined()
  })

  it('retains strict replay failures without throwing from the projection drive', () => {
    const definition = createDraftProjectionDefinition(20)
    const empty = definition.init(Session.create(SessionId('projection-replay')).header, SessionLogOffset(0))
    expect(definition.stateSchema.parse(empty)).toEqual(empty)
    const user = {
      type: 'user/message', seq: 0, time: 1,
      data: createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'user' },
      }),
    } as never
    expect(applyDraftProjection(empty, user, 20)).toBe(empty)
    const turnStart = { type: 'turn/start', seq: 1, time: 2, data: { turn: 1 } } as never
    expect(applyDraftProjection(empty, turnStart, 20)).toBe(empty)

    const malformed = {
      type: 'prompt-draft/change', seq: 1, time: 2,
      data: { kind: 'prompt-draft/change', version: 1, operation: 'create' },
    } as never
    expect(applyDraftProjection(empty, malformed, 20).failure).toMatch(/prompt-draft change must have exactly/)
    expect(applyDraftProjection(empty, malformed, 20).failure).not.toBeNull()

    const foreignKind = {
      type: 'prompt-draft/change', seq: 2, time: 3,
      data: { kind: 'not-a-prompt-draft-change' },
    } as never
    expect(applyDraftProjection(empty, foreignKind, 20).failure).toMatch(/invalid kind/)

    const failed: DraftProjectionState = { ...empty, failure: 'stop replay' }
    expect(applyDraftProjection(failed, foreignKind, 20)).toBe(failed)
  })

  it('rejects a state whose current draft id is not retained among the seen ids', () => {
    const definition = createDraftProjectionDefinition(20)
    const empty = definition.init(Session.create(SessionId('projection-replay')).header, SessionLogOffset(0))
    const state: DraftProjectionState = {
      ...empty,
      current: {
        draft: { id: brandString<DraftId>('d1'), revision: 1, title: 't', body: 'b' },
        createdAt: 1,
        updatedAt: 1,
        versions: [],
      },
    }
    expect(definition.stateSchema.safeParse(state).success).toBe(false)
    expect(definition.stateSchema.safeParse({
      ...state,
      seenDraftIds: [brandString<DraftId>('d1')],
    }).success).toBe(true)
  })

  it('fails host draft access when the projection retained a replay failure', async () => {
    const bench = await harness(true)
    bench.ctx.promptDrafts.create(bench.agent, { body: 'poisoned replay' })
    const failure = 'prompt-draft replay failed at session event 0: invalid restored draft stream'
    const handle = await bench.ctx.sessionProjections.register(createDraftProjectionDefinition(20))
    const state = handle.stateOf(bench.session)
    expect(state).toBeDefined()
    Object.assign(state, { failure })
    expect(() => bench.ctx.promptDrafts.get(bench.agent))
      .toThrow(expect.objectContaining({ name: 'DraftError', code: 'DRAFT_STATE_CORRUPT', message: failure }))
  })

  it('has no promptDraft key when the draft service is not composed', async () => {
    const bench = await harness(false)
    seedMessage(bench.session)
    expect('promptDraft' in (bench.tailValues() ?? {})).toBe(false)
  })

  it('drops the key when the draft fiber unloads (HMR safety)', async () => {
    const bench = await harness(false)
    seedMessage(bench.session)
    const fiber = await bench.ctx.plugin(PromptDraftService)
    expect(bench.tailValues()['promptDraft']).toBeDefined()
    await fiber.dispose()
    expect('promptDraft' in (bench.tailValues() ?? {})).toBe(false)
  })
})
