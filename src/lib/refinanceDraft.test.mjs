import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readRefinanceDraft, saveRefinanceDraft } from './refinanceDraft.js'

test('restores incomplete fields and mode after remount, and clears to defaults', () => {
  let raw = null
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
  const defaults = { principal: '', annualRate: '' }
  assert.deepEqual(readRefinanceDraft(storage, defaults).form, defaults)
  assert.equal(saveRefinanceDraft(storage, { principal: '1000000', annualRate: '' }, 'manual'), true)
  assert.deepEqual(readRefinanceDraft(storage, defaults), { form: { principal: '1000000', annualRate: '' }, payoffMode: 'manual' })
  saveRefinanceDraft(storage, defaults, 'calculated')
  assert.deepEqual(readRefinanceDraft(storage, defaults).form, defaults)
})

test('corrupt and unavailable storage are safe; unknown fields are ignored', () => {
  const defaults = { principal: '' }
  for (const raw of ['bad', 'null', '{"version":2,"form":{}}']) {
    assert.deepEqual(readRefinanceDraft({ getItem: () => raw }, defaults).form, defaults)
  }
  const blocked = { getItem() { throw Error() }, setItem() { throw Error() } }
  assert.deepEqual(readRefinanceDraft(blocked, defaults).form, defaults)
  assert.equal(saveRefinanceDraft(blocked, defaults, 'manual'), false)
  assert.deepEqual(readRefinanceDraft({ getItem: () => JSON.stringify({ version: 1, form: { principal: null, extra: 'x' } }) }, defaults).form, defaults)
})
