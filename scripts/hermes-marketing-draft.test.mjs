import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { approvedSources, stageFireflyJob, readFireflyJob } from './hermes-marketing-draft.mjs'
import { validateHermesDraft, importHermesDraft } from '../src/lib/hermesMarketingDraft.js'

const draft = { version: 1, id: 'a'.repeat(32), title: 'Title', caption: 'Caption #AssetX', imagePrompt: 'Scene',
  sources: [{ file: 'approved.md', sha256: 'b'.repeat(64) }], image: 'data:image/png;base64,aGVsbG8=' }

test('agent cannot supply approval or publishing state', () => {
  const clean = validateHermesDraft({ ...draft, status: 'published', facebookPostId: '123' })
  assert.equal(clean.status, undefined)
  assert.equal(clean.facebookPostId, undefined)
  const result = importHermesDraft({ posts: [{ id: 'existing' }], mediaAssets: [], settings: { kept: true } }, clean)
  assert.equal(result.posts[0].status, 'pending')
  assert.equal(result.posts[0].reviewStatus, 'needs_edit')
  assert.equal(result.posts[1].id, 'existing')
  assert.equal(result.settings.kept, true)
  assert.equal(importHermesDraft(result, clean), result)
})
test('deleted drafts are not resurrected', () => {
  const workspace = { hiddenPostIds: [`hermes-${draft.id}`] }
  assert.equal(importHermesDraft(workspace, draft), workspace)
})
test('invalid images and missing sources are rejected', () => {
  assert.throws(() => validateHermesDraft({ ...draft, image: 'https://example.com/a.png' }))
  assert.throws(() => validateHermesDraft({ ...draft, sources: [] }))
})
test('knowledge requires explicit approval and unchanged content', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'assetx-kb-'))
  try {
    const text = 'Reviewed fixture, not operational knowledge'
    await fs.writeFile(path.join(dir, 'approved.md'), text)
    const entry = { file: 'approved.md', status: 'needs_correction' }
    const manifest = () => fs.writeFile(path.join(dir, 'knowledge-review.json'), JSON.stringify({ files: [entry] }))
    await manifest()
    await assert.rejects(approvedSources(dir, ['approved.md']), /not approved/)
    Object.assign(entry, { status: 'approved', approved_by: 'test reviewer', approved_at: '2026-10-08', sha256: crypto.createHash('sha256').update(text).digest('hex') })
    await manifest()
    assert.equal((await approvedSources(dir, ['approved.md']))[0].text, text)
    const request = { ...draft, requestId: 'telegram-test-123', sources: [{ file: entry.file, sha256: entry.sha256 }] }
    const jobs = path.join(dir, 'jobs')
    const staged = await stageFireflyJob(request, dir, jobs)
    assert.equal(staged.status, 'awaiting_firefly_image')
    assert.equal(staged.published, false)
    assert.equal((await stageFireflyJob(request, dir, jobs)).jobId, staged.jobId)
    assert.equal((await readFireflyJob(jobs, staged.jobId)).caption, request.caption)
    await assert.rejects(stageFireflyJob({ ...request, caption: 'different' }, dir, jobs), /already used/)
    await assert.rejects(readFireflyJob(jobs, '../escape'), /Invalid job/)
    await fs.writeFile(path.join(dir, 'approved.md'), 'changed')
    await assert.rejects(approvedSources(dir, ['approved.md']), /stale/)
    await assert.rejects(stageFireflyJob(request, dir, jobs), /stale/)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})
