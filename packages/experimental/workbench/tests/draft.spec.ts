/**
 * The prompt-draft domain: compare-and-set mutations, live-agent identity,
 * one durable event per mutation, and the version history the projection
 * retains.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { unsupportedModel, unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import PromptDraftService, { decodeDraftChange, foldDraft } from '../src/host/draft-service.ts'
import type { DraftRef } from '../src/host/draft-types.ts'

interface Bench {
  ctx: Context
  session: Session
  agent: Agent
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
    inject: () => { throw new Error('draft domain tests do not inject model context') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle() { return Promise.resolve() },
  }
  await ctx.agents.register(agent)
  return agent
}

/** Build a context carrying the session store, the projection registry, and the draft domain. */
async function harness(): Promise<Bench> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(PromptDraftService)
  const session = ctx.sessions.create()
  const agent = await liveAgent(ctx, session)
  return { ctx, session, agent }
}

/** The durable prompt-draft events of one session, in sequence order. */
function draftEvents(session: Session): SessionEvent[] {
  return session.snapshotEvents().filter(event => event.type === 'prompt-draft/change')
}

describe('prompt-draft domain', () => {
  it('starts with no current draft and no durable event', async () => {
    const bench = await harness()
    expect(bench.ctx.promptDrafts.get(bench.agent)).toBeUndefined()
    expect(draftEvents(bench.session)).toHaveLength(0)
  })

  it('creates one draft and appends exactly one durable event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    try {
      const bench = await harness()
      const created = bench.ctx.promptDrafts.create(bench.agent, {
        title: 'Long-form essay',
        body: 'Write a 2000-word essay about distributed systems.',
      })
      expect(created).toMatchObject({
        revision: 1,
        title: 'Long-form essay',
        body: 'Write a 2000-word essay about distributed systems.',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      })
      const events = draftEvents(bench.session)
      expect(events).toHaveLength(1)
      expect(decodeDraftChange(events[0]?.data)).toMatchObject({
        operation: 'create',
        revision: 1,
        title: 'Long-form essay',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects a second create while a draft is current', async () => {
    const bench = await harness()
    bench.ctx.promptDrafts.create(bench.agent, { body: 'first' })
    expect(() => bench.ctx.promptDrafts.create(bench.agent, { body: 'second' }))
      .toThrow(expect.objectContaining({ name: 'DraftError', code: 'DRAFT_ALREADY_EXISTS' }))
  })

  it('rejects a stale compare-and-set revision', async () => {
    const bench = await harness()
    const created = bench.ctx.promptDrafts.create(bench.agent, { body: 'first' })
    const stale: DraftRef = { id: created.id, revision: created.revision }
    bench.ctx.promptDrafts.update(bench.agent, stale, { body: 'second' })
    expect(() => bench.ctx.promptDrafts.update(bench.agent, stale, { body: 'third' }))
      .toThrow(expect.objectContaining({ name: 'DraftError', code: 'DRAFT_STALE_REVISION' }))
  })

  it('rejects an update that changes nothing', async () => {
    const bench = await harness()
    const created = bench.ctx.promptDrafts.create(bench.agent, { body: 'first' })
    expect(() => bench.ctx.promptDrafts.update(bench.agent, created, {}))
      .toThrow(expect.objectContaining({ name: 'DraftError', code: 'DRAFT_INVALID_UPDATE' }))
  })

  it('rejects a mutation from an agent the registry does not own', async () => {
    const bench = await harness()
    const foreign = { ...bench.agent, id: 'other-agent' } as Agent
    expect(() => bench.ctx.promptDrafts.create(foreign, { body: 'nope' }))
      .toThrow(expect.objectContaining({ name: 'DraftError', code: 'DRAFT_AGENT_NOT_LIVE' }))
  })

  it('advances the revision and keeps the superseded body out of the update event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    try {
      const bench = await harness()
      const created = bench.ctx.promptDrafts.create(bench.agent, { title: 'Draft', body: 'first body' })
      const updated = bench.ctx.promptDrafts.update(bench.agent, created, { body: 'second body' })
      expect(updated).toMatchObject({ revision: 2, title: 'Draft', body: 'second body' })
      const events = draftEvents(bench.session)
      expect(events).toHaveLength(2)
      const change = decodeDraftChange(events[1]?.data)
      expect(change).toMatchObject({ operation: 'update', revision: 2, parentRevision: 1, body: 'second body' })
      expect(change).not.toHaveProperty('title')
    } finally {
      vi.useRealTimers()
    }
  })

  it('retains the superseded revisions as version history', async () => {
    const bench = await harness()
    const created = bench.ctx.promptDrafts.create(bench.agent, { body: 'v1' })
    bench.ctx.promptDrafts.update(bench.agent, created, { body: 'v2' })
    const second = bench.ctx.promptDrafts.get(bench.agent)
    if (second === undefined) throw new Error('expected a current draft')
    bench.ctx.promptDrafts.update(bench.agent, second, { body: 'v3' })
    const projection = bench.ctx.sessionProjections.snapshot(bench.session).values['promptDraft']
    if (projection === undefined) throw new Error('expected a promptDraft projection')
    expect(projection).toMatchObject({ draft: { revision: 3, body: 'v3' } })
    expect(projection.versions).toHaveLength(2)
    expect(projection.versions.map(version => version.body)).toEqual(['v1', 'v2'])
  })

  it('folds the durable events into the current draft and its history', async () => {
    const bench = await harness()
    const created = bench.ctx.promptDrafts.create(bench.agent, { title: 'T', body: 'v1' })
    bench.ctx.promptDrafts.update(bench.agent, created, { body: 'v2' })
    const folded = foldDraft(bench.session.snapshotEvents(), 20)
    expect(folded.current).toMatchObject({ revision: 2, title: 'T', body: 'v2' })
    expect(folded.versions).toHaveLength(1)
    expect(folded.versions[0]).toMatchObject({ revision: 1, body: 'v1' })
  })

  it('clears the current draft with one tombstone event', async () => {
    const bench = await harness()
    const created = bench.ctx.promptDrafts.create(bench.agent, { body: 'temporary' })
    const tombstone = bench.ctx.promptDrafts.clear(bench.agent, created)
    expect(tombstone).toMatchObject({ id: created.id, revision: 2 })
    expect(bench.ctx.promptDrafts.get(bench.agent)).toBeUndefined()
    const events = draftEvents(bench.session)
    expect(events).toHaveLength(2)
    expect(decodeDraftChange(events[1]?.data)).toMatchObject({ operation: 'clear' })
  })
})
