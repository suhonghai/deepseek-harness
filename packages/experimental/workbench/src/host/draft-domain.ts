/**
 * Host-side vocabulary of the prompt-draft domain: the durable change
 * payloads the session log carries. Kept separate from ./draft-types.ts (the
 * pure client-safe outlet) because these declarations pull the session event
 * vocabulary into the program.
 *
 * @module @deepseek-ai/dsh-workbench/host/draft-domain
 */

import type { DraftId, DraftRef } from './draft-types.ts'

/** Durable change operations recorded by the prompt-draft domain. */
export type DraftOperation = 'create' | 'update' | 'clear'

/** First draft of one lineage, carrying its complete initial content. */
export interface DraftCreateChangeMeta {
  readonly kind: 'prompt-draft/change'
  readonly version: 1
  readonly operation: 'create'
  /** Identity of the created draft. */
  readonly draft: DraftId
  /** Revision of the created draft; always one. */
  readonly revision: number
  /** Initial draft label. */
  readonly title: string
  /** Initial draft body. */
  readonly body: string
  /** Epoch milliseconds of the create mutation. */
  readonly createdAt: number
  /** Epoch milliseconds of the create mutation. */
  readonly updatedAt: number
}

/**
 * One revision of the current draft, carrying only the content that
 * changed. The projection composes the current whole draft from it, so a
 * title-only edit does not duplicate the body in the session log.
 */
export interface DraftUpdateChangeMeta {
  readonly kind: 'prompt-draft/change'
  readonly version: 1
  readonly operation: 'update'
  /** Identity of the updated draft. */
  readonly draft: DraftId
  /** Revision the update produces. */
  readonly revision: number
  /** Revision the update supersedes. */
  readonly parentRevision: number
  /** Replacement label; absent when the label is unchanged. */
  readonly title?: string
  /** Replacement body; absent when the body is unchanged. */
  readonly body?: string
  /** Epoch milliseconds of the update mutation. */
  readonly updatedAt: number
}

/** Tombstone retained when the current draft is cleared. */
export interface DraftClearChangeMeta {
  readonly kind: 'prompt-draft/change'
  readonly version: 1
  readonly operation: 'clear'
  /** The cleared draft's identity and the revision the clear produces. */
  readonly cleared: DraftRef
  /** Epoch milliseconds of the clear mutation. */
  readonly clearedAt: number
}

/** Durable change union carried by the prompt-draft session event. */
export type DraftChangeMeta = DraftCreateChangeMeta | DraftUpdateChangeMeta | DraftClearChangeMeta

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * One durable prompt-draft mutation: a create with its initial content,
     * an update with only the changed content, or a clear tombstone.
     */
    'prompt-draft/change': DraftChangeMeta
  }
}
