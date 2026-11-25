/**
 * Pure replay fold and strict decoder for durable prompt-draft changes.
 *
 * @module @deepseek-ai/dsh-workbench/host/draft-fold
 */

import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { DraftId, DraftRef, DraftRevision, DraftSnapshot } from './draft-types.ts'
import { DRAFT_CHANGE_VERSION } from './draft-runtime.ts'
import type {
  DraftChangeMeta,
  DraftClearChangeMeta,
  DraftCreateChangeMeta,
  DraftUpdateChangeMeta,
} from './draft-domain.ts'

/** Mutable accumulator kept private to the pure fold. */
export interface DraftFoldState {
  current: DraftSnapshot | undefined
  createdAt: number | undefined
  updatedAt: number | undefined
  versions: DraftRevision[]
  seenDraftIds: Set<DraftId>
}

/**
 * Build an empty replay accumulator.
 * @returns mutable state with no current draft and no retained revision.
 */
export function emptyDraftFoldState(): DraftFoldState {
  return {
    current: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    versions: [],
    seenDraftIds: new Set(),
  }
}

/** Whether a value is a JSON record rather than an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Require one positive safe integer. */
function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`prompt-draft change ${field} must be a positive safe integer`)
  }
  return value
}

/** Require one non-negative safe integer. */
function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`prompt-draft change ${field} must be a non-negative safe integer`)
  }
  return value
}

/** Require one draft identifier. */
function draftId(value: unknown, field: string): DraftId {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`prompt-draft change ${field} must be a non-empty string`)
  }
  return brandString<DraftId>(value)
}

/**
 * Require that a change carries exactly the named fields.
 * @param value - the change record.
 * @param expected - the exact field names the operation carries.
 */
function requireExactFields(value: Record<string, unknown>, expected: readonly string[]): void {
  if (Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) {
    throw new Error(`prompt-draft change must have exactly ${[...expected].sort().join(',')} fields`)
  }
}

/**
 * Decode and validate one ref.
 * @param value - candidate tombstone ref.
 * @returns the validated ref.
 */
function decodeRef(value: unknown): DraftRef {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'id,revision') {
    throw new Error('prompt-draft clear tombstone must have exactly id and revision fields')
  }
  return { id: draftId(value['id'], 'cleared.id'), revision: positiveInteger(value['revision'], 'cleared.revision') }
}

/**
 * Decode a value that declares itself as a prompt-draft change. Unrelated
 * values return `undefined`; malformed prompt-draft changes fail replay
 * loudly.
 * @param value - candidate source change.
 * @returns validated prompt-draft change or `undefined` for another value kind.
 */
export function decodeDraftChange(value: unknown): DraftChangeMeta | undefined {
  if (!isRecord(value) || value['kind'] !== 'prompt-draft/change') return undefined
  if (value['version'] !== DRAFT_CHANGE_VERSION) {
    throw new Error(`unsupported prompt-draft change version ${String(value['version'])}`)
  }
  const operation = value['operation']
  if (operation === 'create') {
    requireExactFields(value, [
      'body', 'createdAt', 'draft', 'kind', 'operation', 'revision', 'title', 'updatedAt', 'version',
    ])
    const createdAt = nonNegativeInteger(value['createdAt'], 'createdAt')
    const updatedAt = nonNegativeInteger(value['updatedAt'], 'updatedAt')
    if (updatedAt < createdAt) throw new Error('prompt-draft change updatedAt cannot precede createdAt')
    return {
      kind: 'prompt-draft/change',
      version: DRAFT_CHANGE_VERSION,
      operation: 'create',
      draft: draftId(value['draft'], 'draft'),
      revision: positiveInteger(value['revision'], 'revision'),
      title: decodeText(value['title'], 'title'),
      body: decodeText(value['body'], 'body'),
      createdAt,
      updatedAt,
    } satisfies DraftCreateChangeMeta
  }
  if (operation === 'update') {
    const allowed = [
      'body', 'draft', 'kind', 'operation', 'parentRevision', 'revision', 'title', 'updatedAt', 'version',
    ]
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        throw new Error(`prompt-draft change must have exactly ${allowed.sort().join(',')} fields`)
      }
    }
    for (const key of ['draft', 'kind', 'operation', 'parentRevision', 'revision', 'updatedAt', 'version']) {
      if (!Object.hasOwn(value, key)) {
        throw new Error(`prompt-draft change must have exactly ${allowed.sort().join(',')} fields`)
      }
    }
    const hasTitle = Object.hasOwn(value, 'title')
    const hasBody = Object.hasOwn(value, 'body')
    if (!hasTitle && !hasBody) {
      throw new Error('prompt-draft update must change the title, the body, or both')
    }
    return {
      kind: 'prompt-draft/change',
      version: DRAFT_CHANGE_VERSION,
      operation: 'update',
      draft: draftId(value['draft'], 'draft'),
      revision: positiveInteger(value['revision'], 'revision'),
      parentRevision: positiveInteger(value['parentRevision'], 'parentRevision'),
      ...hasTitle ? { title: decodeText(value['title'], 'title') } : {},
      ...hasBody ? { body: decodeText(value['body'], 'body') } : {},
      updatedAt: nonNegativeInteger(value['updatedAt'], 'updatedAt'),
    } satisfies DraftUpdateChangeMeta
  }
  if (operation === 'clear') {
    requireExactFields(value, ['cleared', 'clearedAt', 'kind', 'operation', 'version'])
    return {
      kind: 'prompt-draft/change',
      version: DRAFT_CHANGE_VERSION,
      operation: 'clear',
      cleared: decodeRef(value['cleared']),
      clearedAt: nonNegativeInteger(value['clearedAt'], 'clearedAt'),
    } satisfies DraftClearChangeMeta
  }
  throw new Error('prompt-draft change operation is invalid')
}

/** Require one draft text field. */
function decodeText(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`prompt-draft change ${field} must be a string`)
  }
  return value
}

/**
 * Return the revision identity carried by a change.
 * @param change - decoded prompt-draft mutation.
 * @returns stable identity used to reconcile a deferred change with its log event.
 */
export function draftChangeRef(change: DraftChangeMeta): DraftRef {
  return change.operation === 'clear'
    ? change.cleared
    : { id: change.draft, revision: change.revision }
}

/**
 * Validate and apply one decoded change to a mutable accumulator.
 * @param state - preceding durable draft projection.
 * @param change - decoded create, update, or clear tombstone.
 * @param maxVersions - number of superseded revisions the projection retains.
 */
export function applyDraftChange(
  state: DraftFoldState,
  change: DraftChangeMeta,
  maxVersions: number,
): void {
  if (change.operation === 'clear') {
    const current = state.current
    if (current === undefined) throw new Error('prompt-draft clear requires a current draft')
    if (change.cleared.id !== current.id || change.cleared.revision !== current.revision + 1) {
      throw new Error('prompt-draft clear must advance the current draft by one revision')
    }
    /* v8 ignore next -- a current draft established by this fold always has an updatedAt */
    if (state.updatedAt === undefined) throw new Error('current draft fold lacks updatedAt')
    if (change.clearedAt < state.updatedAt) {
      throw new Error('prompt-draft clear timestamp cannot precede the current draft update')
    }
    state.current = undefined
    state.createdAt = undefined
    state.updatedAt = undefined
    return
  }
  if (change.operation === 'create') {
    if (change.revision !== 1) throw new Error('prompt-draft create requires revision one')
    if (state.current !== undefined) throw new Error('prompt-draft create requires no current draft')
    if (state.seenDraftIds.has(change.draft)) throw new Error('prompt-draft create reuses a known draft id')
    state.seenDraftIds.add(change.draft)
    state.current = { id: change.draft, revision: 1, title: change.title, body: change.body }
    state.createdAt = change.createdAt
    state.updatedAt = change.updatedAt
    state.versions = []
    return
  }
  const current = state.current
  if (current === undefined) throw new Error('prompt-draft update requires a current draft')
  if (change.draft !== current.id) throw new Error('prompt-draft update must address the current draft')
  if (change.parentRevision !== current.revision || change.revision !== current.revision + 1) {
    throw new Error('prompt-draft update must advance the current draft by one revision')
  }
  /* v8 ignore next -- a current draft established by this fold always has an updatedAt */
  if (state.updatedAt === undefined) throw new Error('current draft fold lacks updatedAt')
  if (change.updatedAt < state.updatedAt) {
    throw new Error('prompt-draft update cannot precede the current draft update')
  }
  state.versions = [
    ...state.versions,
    {
      id: current.id,
      revision: current.revision,
      title: current.title,
      body: current.body,
      updatedAt: state.updatedAt,
    },
  ].slice(-maxVersions)
  state.current = {
    id: current.id,
    revision: change.revision,
    title: change.title === undefined ? current.title : change.title,
    body: change.body === undefined ? current.body : change.body,
  }
  state.updatedAt = change.updatedAt
}

/**
 * Apply one session event to the strict durable draft fold.
 * @param state - mutable fold accumulator.
 * @param event - next event in sequence order.
 * @param maxVersions - number of superseded revisions the projection retains.
 */
export function applyDraftEvent(
  state: DraftFoldState,
  event: SessionEvent,
  maxVersions: number,
): void {
  if (event.type !== 'prompt-draft/change') return
  const change = decodeDraftChange(event.data)
  /* v8 ignore next -- the event's declared payload always identifies itself as a prompt-draft change. */
  if (change === undefined) throw new Error(`prompt-draft change at session event ${event.seq} has an invalid kind`)
  applyDraftChange(state, change, maxVersions)
}

/**
 * Fold current draft state from a contiguous session event log.
 * @param events - session events in sequence order.
 * @param maxVersions - number of superseded revisions the projection retains.
 * @returns a fresh durable projection.
 */
export function foldDraft(events: readonly SessionEvent[], maxVersions: number): {
  current: DraftSnapshot | undefined
  createdAt: number | undefined
  updatedAt: number | undefined
  versions: DraftRevision[]
} {
  const state = emptyDraftFoldState()
  for (const event of events) applyDraftEvent(state, event, maxVersions)
  return {
    current: state.current,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    versions: state.versions,
  }
}
