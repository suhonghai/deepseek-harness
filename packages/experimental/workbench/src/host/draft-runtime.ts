/**
 * Runtime constructors and protocol constants for the prompt-draft domain.
 *
 * @module @deepseek-ai/dsh-workbench/host/draft-runtime
 */

import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { DraftId as DraftIdType } from './draft-types.ts'

/** Version of the durable prompt-draft change payload. */
export const DRAFT_CHANGE_VERSION = 1

/** Default number of superseded revisions the projection retains. */
export const DEFAULT_MAX_DRAFT_VERSIONS = 20

/** Stable error codes for rejected draft reads and mutations. */
export type DraftErrorCode =
  | 'DRAFT_AGENT_NOT_LIVE'
  | 'DRAFT_NOT_FOUND'
  | 'DRAFT_ALREADY_EXISTS'
  | 'DRAFT_STALE_REVISION'
  | 'DRAFT_INVALID_TITLE'
  | 'DRAFT_INVALID_BODY'
  | 'DRAFT_INVALID_UPDATE'
  | 'DRAFT_STATE_CORRUPT'

/**
 * Brand a string as a draft id.
 * @param id - raw draft identifier.
 * @returns the same string with the compile-time brand.
 */
export function DraftId(id: string): DraftIdType {
  return id as DraftIdType
}

/** Error returned by the prompt-draft domain boundary. */
export class DraftError extends HarnessError {
  /**
   * @param message - human-readable rejection reason.
   * @param code - stable machine-routable classification.
   */
  constructor(message: string, code: DraftErrorCode) {
    super(message, code)
    this.name = 'DraftError'
  }
}
