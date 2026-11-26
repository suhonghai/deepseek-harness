/**
 * Same-session prompt-draft domain: event-sourced state, compare-and-set
 * mutations, and a version history the user and the model read together.
 *
 * @module @deepseek-ai/dsh-workbench/host/draft-service
 */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { ProjectionDefinition, ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import { applyDraftEvent } from './draft-fold.ts'
import type { DraftFoldState } from './draft-fold.ts'
import { DRAFT_CHANGE_VERSION, DEFAULT_MAX_DRAFT_VERSIONS, DraftError } from './draft-runtime.ts'
import type { DraftId } from './draft-types.ts'
import type {
  CreateDraftRequest,
  DraftProjection,
  DraftProjectionState,
  DraftRef,
  DraftRevision,
  DraftView,
  UpdateDraftRequest,
} from './draft-types.ts'
import type { DraftChangeMeta, DraftClearChangeMeta, DraftCreateChangeMeta, DraftUpdateChangeMeta } from './draft-domain.ts'

export type * from './draft-types.ts'
export { DRAFT_CHANGE_VERSION, DraftError } from './draft-runtime.ts'
export { decodeDraftChange, draftChangeRef, foldDraft } from './draft-fold.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    promptDrafts: PromptDraftService
  }
}

/** Wire payload schema of the `promptDraft` projection. */
const draftIdSchema = zod.custom<DraftId>(value => typeof value === 'string' && value.length > 0)

const draftSnapshotSchema = zod.object({
  id: draftIdSchema,
  revision: zod.number().int().positive(),
  title: zod.string(),
  body: zod.string(),
})

const draftRevisionSchema: ZodType<DraftRevision> = zod.object({
  id: draftIdSchema,
  revision: zod.number().int().positive(),
  title: zod.string(),
  body: zod.string(),
  updatedAt: zod.number(),
})

const draftProjectionSchema: ZodType<DraftProjection> = zod.object({
  draft: draftSnapshotSchema.nullable(),
  createdAt: zod.number().nullable(),
  updatedAt: zod.number().nullable(),
  versions: zod.array(draftRevisionSchema),
})

const draftProjectionStateSchema: ZodType<DraftProjectionState> = zod.object({
  current: draftProjectionSchema,
  seenDraftIds: zod.array(draftIdSchema).refine(
    ids => new Set(ids).size === ids.length,
    { message: 'seen draft ids must be unique' },
  ),
  failure: zod.string().min(1).nullable(),
}).strict().superRefine((state, context) => {
  const current = state.current.draft
  if (current === null) return
  if (!state.seenDraftIds.includes(current.id)) {
    context.addIssue({ code: 'custom', message: 'current draft id must be retained among seen draft ids' })
  }
  const { createdAt, updatedAt } = state.current
  if (createdAt !== null && updatedAt !== null && updatedAt < createdAt) {
    context.addIssue({ code: 'custom', message: 'current draft update cannot precede its creation' })
  }
})

/** Build strict fold state from one checkpoint-safe projection state. */
function draftFoldState(state: DraftProjectionState): DraftFoldState {
  return {
    current: state.current.draft ?? undefined,
    createdAt: state.current.createdAt ?? undefined,
    updatedAt: state.current.updatedAt ?? undefined,
    versions: [...state.current.versions],
    seenDraftIds: new Set(state.seenDraftIds),
  }
}

/** Convert strict fold state into checkpoint-safe projection state. */
function draftProjectionState(state: DraftFoldState): DraftProjectionState {
  if (state.current !== undefined && (state.createdAt === undefined || state.updatedAt === undefined)) {
    throw new Error('current draft fold lacks timestamps')
  }
  return {
    current: {
      draft: state.current ?? null,
      createdAt: state.createdAt ?? null,
      updatedAt: state.updatedAt ?? null,
      versions: [...state.versions],
    },
    seenDraftIds: [...state.seenDraftIds],
    failure: null,
  }
}

/**
 * Fold durable prompt-draft events through the strict replay rules without
 * throwing from the projection registry's event drive. The first invalid
 * owned event is retained in `failure`; host draft access rejects that state
 * while the client view remains at the last valid draft.
 * @param state - the projection covering all prior events.
 * @param event - the next committed session event.
 * @param maxVersions - number of superseded revisions the projection retains.
 * @returns the next projection (same reference when the event is unrelated).
 */
export function applyDraftProjection(
  state: DraftProjectionState,
  event: SessionEvent,
  maxVersions: number,
): DraftProjectionState {
  if (state.failure !== null) return state
  if (event.type !== 'prompt-draft/change') return state
  const folded = draftFoldState(state)
  try {
    applyDraftEvent(folded, event, maxVersions)
    return draftProjectionState(folded)
  } catch (error: unknown) {
    /* v8 ignore next -- the strict draft fold throws Error instances. */
    const message = error instanceof Error ? error.message : String(error)
    return { ...state, failure: `prompt-draft replay failed at session event ${event.seq}: ${message}` }
  }
}

/**
 * The `promptDraft` projection definition, with its client view required so
 * the registry accepts it as a rendered unit.
 */
export type DraftProjectionDefinition = ProjectionDefinition<'promptDraft', DraftProjectionState>
  & { readonly wire: NonNullable<ProjectionDefinition<'promptDraft', DraftProjectionState>['wire']> }

/**
 * Build the `promptDraft` projection definition for one retention cap.
 * @param maxVersions - number of superseded revisions the projection retains.
 * @returns the projection definition registered by the service.
 */
export function createDraftProjectionDefinition(maxVersions: number): DraftProjectionDefinition {
  return {
    key: 'promptDraft',
    stateSchema: draftProjectionStateSchema,
    init: (): DraftProjectionState => ({
      current: { draft: null, createdAt: null, updatedAt: null, versions: [] },
      seenDraftIds: [],
      failure: null,
    }),
    apply: (state: DraftProjectionState, event: SessionEvent) => applyDraftProjection(state, event, maxVersions),
    wire: { viewSchema: draftProjectionSchema, view: (state: DraftProjectionState) => state.current },
    stateVersion: 1,
  }
}

/** Deployment defaults for the prompt-draft domain. */
export interface Config {
  /** Number of superseded revisions the projection retains. */
  maxVersions?: number
}

/** Resolved defaults. */
export interface ResolvedConfig {
  /** Validated positive safe-integer revision retention cap. */
  readonly maxVersions: number
}

/** Validate the retained-revision cap. */
function resolveMaxVersions(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DraftError('maxVersions must be a positive safe integer', 'DRAFT_INVALID_UPDATE')
  }
  return value
}

/** Validate and normalize a draft label at the domain boundary. */
function resolveTitle(value: string | undefined): string {
  if (value === undefined) return 'Untitled draft'
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DraftError('draft title must be a non-empty string', 'DRAFT_INVALID_TITLE')
  }
  return value.trim()
}

/** Validate and normalize a draft body at the domain boundary. */
function resolveBody(value: string, code: 'DRAFT_INVALID_BODY' | 'DRAFT_INVALID_UPDATE'): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DraftError('draft body must be a non-empty string', code)
  }
  return value
}

/** Prompt-draft service (`ctx.promptDrafts`) backed exclusively by the owning session log. */
export class PromptDraftService extends TypertRemoteService {
  static inject = ['agents', 'sessionProjections']

  static Config: z<Config> = z.object({
    maxVersions: z.number().default(DEFAULT_MAX_DRAFT_VERSIONS),
  })

  private readonly resolved: ResolvedConfig

  private draftProjectionHandle!: ProjectionHandle<DraftProjectionState>

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'promptDrafts')
    this.resolved = {
      maxVersions: resolveMaxVersions(config.maxVersions ?? DEFAULT_MAX_DRAFT_VERSIONS),
    }
  }

  protected async [Service.init](): Promise<void> {
    this.draftProjectionHandle = await this.ctx.sessionProjections.register(
      createDraftProjectionDefinition(this.resolved.maxVersions),
    )
  }

  /**
   * Read the current draft for one exact live agent.
   * @param agent - owning live agent.
   * @returns a fresh view or `undefined` when no draft is current.
   * @throws {@link DraftError} when the agent is not the registry's live instance.
   */
  @Remote('get')
  get(agent: Agent): DraftView | undefined {
    this.assertLive(agent)
    return this.view(this.state(agent.session))
  }

  /**
   * Read the current draft for one session without requiring a live agent.
   * The prompt section uses it to render the draft without a calling agent.
   * @param session - session owning the draft.
   * @returns a fresh view or `undefined` when no draft is current.
   */
  draftOf(session: Session): DraftView | undefined {
    return this.view(this.state(session))
  }

  /**
   * Create the session's first draft.
   * @param agent - owning live agent.
   * @param request - initial body and optional label.
   * @returns the created view.
   */
  @Remote('create')
  create(agent: Agent, request: CreateDraftRequest): DraftView {
    this.assertLive(agent)
    const state = this.state(agent.session)
    if (state.draft !== null) {
      throw new DraftError('a prompt draft is already current', 'DRAFT_ALREADY_EXISTS')
    }
    const now = Date.now()
    const change: DraftCreateChangeMeta = {
      kind: 'prompt-draft/change',
      version: DRAFT_CHANGE_VERSION,
      operation: 'create',
      draft: `draft-${randomUUID()}` as DraftId,
      revision: 1,
      title: resolveTitle(request.title),
      body: resolveBody(request.body, 'DRAFT_INVALID_BODY'),
      createdAt: now,
      updatedAt: now,
    }
    this.commit(agent, change)
    return this.view(this.state(agent.session)) as DraftView
  }

  /**
   * Replace the label, the body, or both, advancing the revision by one.
   * @param agent - owning live agent.
   * @param ref - expected current revision.
   * @param request - at least one replacement field.
   * @returns the updated view.
   */
  @Remote('update')
  update(agent: Agent, ref: DraftRef, request: UpdateDraftRequest): DraftView {
    this.assertLive(agent)
    const state = this.state(agent.session)
    const current = state.draft
    if (current === null) throw new DraftError('no current prompt draft', 'DRAFT_NOT_FOUND')
    if (ref.id !== current.id || ref.revision !== current.revision) {
      throw new DraftError(
        `stale draft ref "${ref.id}" revision ${ref.revision}; current is "${current.id}" revision ${current.revision}`,
        'DRAFT_STALE_REVISION',
      )
    }
    if (request.title === undefined && request.body === undefined) {
      throw new DraftError('draft update requires a title, a body, or both', 'DRAFT_INVALID_UPDATE')
    }
    const change: DraftUpdateChangeMeta = {
      kind: 'prompt-draft/change',
      version: DRAFT_CHANGE_VERSION,
      operation: 'update',
      draft: current.id,
      revision: current.revision + 1,
      parentRevision: current.revision,
      ...request.title === undefined ? {} : { title: resolveTitle(request.title) },
      ...request.body === undefined ? {} : { body: resolveBody(request.body, 'DRAFT_INVALID_UPDATE') },
      updatedAt: Math.max(Date.now(), state.updatedAt ?? 0),
    }
    this.commit(agent, change)
    return this.view(this.state(agent.session)) as DraftView
  }

  /**
   * Clear the current draft while retaining a durable tombstone and history.
   * @param agent - owning live agent.
   * @param ref - expected current revision.
   * @returns the tombstone ref whose revision is one past the cleared draft.
   */
  @Remote('clear')
  clear(agent: Agent, ref: DraftRef): DraftRef {
    this.assertLive(agent)
    const state = this.state(agent.session)
    const current = state.draft
    if (current === null) throw new DraftError('no current prompt draft', 'DRAFT_NOT_FOUND')
    if (ref.id !== current.id || ref.revision !== current.revision) {
      throw new DraftError(
        `stale draft ref "${ref.id}" revision ${ref.revision}; current is "${current.id}" revision ${current.revision}`,
        'DRAFT_STALE_REVISION',
      )
    }
    const tombstone: DraftRef = { id: current.id, revision: current.revision + 1 }
    const change: DraftClearChangeMeta = {
      kind: 'prompt-draft/change',
      version: DRAFT_CHANGE_VERSION,
      operation: 'clear',
      cleared: tombstone,
      clearedAt: Math.max(Date.now(), state.updatedAt ?? 0),
    }
    this.commit(agent, change)
    return { ...tombstone }
  }

  /** Enforce exact live-agent identity rather than trusting a matching id. */
  private assertLive(agent: Agent): void {
    if (this.ctx.agents.get(agent.id) !== agent) {
      throw new DraftError(`agent "${agent.id}" is not live in this registry`, 'DRAFT_AGENT_NOT_LIVE')
    }
  }

  /** Read the current durable projection maintained by the registry. */
  private state(session: Session): DraftProjection {
    const state = this.draftProjectionHandle.stateOf(session)
    if (state.failure !== null) throw new DraftError(state.failure, 'DRAFT_STATE_CORRUPT')
    return state.current
  }

  /** Build a detached current view. */
  private view(state: DraftProjection): DraftView | undefined {
    if (state.draft === null) return undefined
    return {
      ...state.draft,
      createdAt: state.createdAt ?? 0,
      updatedAt: state.updatedAt ?? 0,
    }
  }

  /** Commit one mutation into the owning session log. */
  private commit(agent: Agent, change: DraftChangeMeta): void {
    agent.session.append('prompt-draft/change', change)
  }
}

export default PromptDraftService
