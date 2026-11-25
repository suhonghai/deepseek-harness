/**
 * Pure types of the prompt-draft domain: the ONE home of the `promptDraft`
 * projection-key declaration plus the durable payload vocabulary it carries.
 * Free of host-side imports (cordis, dsh-agent, dsh-llm, the service), so the
 * browser half can project the same single-source content the host serves.
 *
 * @module @deepseek-ai/dsh-workbench/host/draft-types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Identifies one prompt draft across its durable revisions. */
export type DraftId = Branded<'DraftId'>

/** Compare-and-set identity for one exact draft revision. */
export interface DraftRef {
  /** Stable draft identity. */
  readonly id: DraftId
  /** Positive revision; every durable mutation increments it. */
  readonly revision: number
}

/** Durable draft content at one exact revision. */
export interface DraftSnapshot extends DraftRef {
  /** Short human label for the draft. */
  readonly title: string
  /** The article-generation prompt the user and the model refine together. */
  readonly body: string
}

/** One superseded draft revision retained for version history. */
export interface DraftRevision extends DraftSnapshot {
  /** Epoch milliseconds of the update that superseded this revision. */
  readonly updatedAt: number
}

/** Input whose omitted title is resolved by the service. */
export interface CreateDraftRequest {
  /** Optional draft label; the service defaults it when omitted. */
  readonly title?: string
  /** The initial draft body. */
  readonly body: string
}

/** Fields changed by an update; at least one must be present. */
export interface UpdateDraftRequest {
  /** Replacement draft label. */
  readonly title?: string
  /** Replacement draft body. */
  readonly body?: string
}

/** Wire-safe acknowledgement of one created draft. */
export interface CreateDraftResult {
  /** The created draft's compare-and-set identity. */
  readonly ref: DraftRef
}

/** Current draft projection, including values derived from the session log. */
export interface DraftProjection {
  /** Current durable draft snapshot, or null before creation and after a clear. */
  readonly draft: DraftSnapshot | null
  /** Epoch milliseconds of the create mutation, or null without a current draft. */
  readonly createdAt: number | null
  /** Epoch milliseconds of the latest mutation, or null without a current draft. */
  readonly updatedAt: number | null
  /** Superseded revisions of the current draft lineage, oldest first. */
  readonly versions: readonly DraftRevision[]
}

/** Live draft view returned to the model, the tools, and the commands. */
export interface DraftView extends DraftSnapshot {
  /** Epoch milliseconds of the create mutation. */
  readonly createdAt: number
  /** Epoch milliseconds of the latest mutation. */
  readonly updatedAt: number
}

/** Strict checkpoint state used to derive the current draft client value. */
export interface DraftProjectionState {
  /** Latest valid draft projection, including the retained version history. */
  readonly current: DraftProjection
  /** Draft identities already created in this Session, retained to reject reuse. */
  readonly seenDraftIds: readonly DraftId[]
  /** First strict replay failure, or null while the durable stream is valid. */
  readonly failure: string | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * The session's prompt draft: the current whole draft, or `null` before
     * the first create and after a clear tombstone, plus the superseded
     * revisions of its lineage. `prompt-draft/change` carries the changed
     * content only; the projection composes the current whole draft.
     */
    promptDraft: DraftProjection
  }
}
