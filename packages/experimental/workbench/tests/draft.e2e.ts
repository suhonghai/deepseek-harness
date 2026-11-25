import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

const binScript = fileURLToPath(new URL('../../../test-support/loader-smoke/tests/fixtures/headless-driver.ts', import.meta.url))
const configPath = fileURLToPath(new URL(
  './fixtures/domain/draft.patch.yml',
  import.meta.url,
))
const repoTsconfig = fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url))

async function jsonlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return jsonlFiles(path)
    return entry.isFile() && entry.name.endsWith('.jsonl') ? [path] : []
  }))
  return paths.flat()
}

describe('prompt-draft domain through the production headless profile and process', () => {
  it('persists the draft change in the session log', async () => {
    let events: SessionEvent[] = []
    const { stdout, stderr } = await runLoaderSmoke({
      label: 'prompt-draft-domain',
      tempDirPrefix: 'prompt-draft-domain-e2e-',
      binScript,
      libBinScript: binScript,
      configPath,
      binArgs: [configPath, 'prove the persisted prompt draft domain'],
      tsconfigPath: repoTsconfig,
      inspect: async (cwd) => {
        const logs = await jsonlFiles(join(cwd, '.sessions'))
        expect(logs).toHaveLength(1)
        const lines = (await readFile(logs[0] as string, 'utf8')).trimEnd().split('\n')
        events = lines.slice(1).map(line => JSON.parse(line) as SessionEvent)
      },
    })
    expect(stderr).toBe('')
    const result = JSON.parse(stdout.trimEnd().split('\n').at(-1) ?? '') as Record<string, unknown>
    expect(result).toMatchObject({
      type: 'result',
    })
    expect(result['output']).toBeTypeOf('string')

    const changes = events.filter(event => event.type === 'prompt-draft/change')
    expect(changes).toHaveLength(1)
    const change = changes[0]
    if (change?.type !== 'prompt-draft/change') throw new Error('expected a prompt-draft change event')
    expect(change.data).toMatchObject({
      kind: 'prompt-draft/change',
      version: 1,
      operation: 'create',
      revision: 1,
      title: 'Prove the composed draft survives in the session log',
      body: 'Prove the composed draft survives in the session log',
    })
    // The durable log carries the draft content only; no process-local state.
    expect(JSON.stringify(change)).not.toContain('activation')
    expect(JSON.stringify(change)).not.toContain('maxVersions')
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
