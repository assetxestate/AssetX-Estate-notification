import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { validateHermesDraft } from '../src/lib/hermesMarketingDraft.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })
config({ path: path.join(repo, '.local', 'hermes-marketing.env'), quiet: true })
const digest = (text) => crypto.createHash('sha256').update(text).digest('hex')

export async function stageFireflyJob(input, root, directory) {
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(input.requestId || '')) throw new Error('Stable requestId required')
  const sources = await approvedSources(root, input.sources?.map((source) => source.file))
  if (sources.some((source, i) => source.sha256 !== input.sources[i].sha256)) throw new Error('Source changed since content was drafted')
  const id = digest(input.requestId).slice(0, 32)
  const validated = validateHermesDraft({ ...input, version: 1, id, sources, image: 'data:image/png;base64,AA==' })
  const job = { requestId: input.requestId, title: validated.title, caption: validated.caption, imagePrompt: validated.imagePrompt, sources: validated.sources }
  await fs.mkdir(directory, { recursive: true })
  const target = path.join(directory, `${id}.json`)
  const serialized = JSON.stringify(job)
  try { await fs.writeFile(target, serialized, { flag: 'wx' }) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    if (await fs.readFile(target, 'utf8') !== serialized) throw new Error('Job ID already used for different content')
  }
  return { success: true, status: 'awaiting_firefly_image', jobId: id, imagePrompt: job.imagePrompt, published: false }
}

export async function readFireflyJob(directory, id) {
  if (!/^[a-f0-9]{32}$/.test(id || '')) throw new Error('Invalid job ID')
  return JSON.parse(await fs.readFile(path.join(directory, `${id}.json`), 'utf8'))
}

export async function approvedSources(root, names) {
  const base = await fs.realpath(root)
  const manifest = JSON.parse(await fs.readFile(path.join(base, 'knowledge-review.json'), 'utf8'))
  if (!Array.isArray(names) || !names.length || names.length > 8) throw new Error('Select 1-8 approved knowledge files')
  return Promise.all(names.map(async (name) => {
    if (typeof name !== 'string' || !name.endsWith('.md')) throw new Error('Invalid knowledge filename')
    const entry = manifest.files.find((item) => item.file === name)
    if (entry?.status !== 'approved') throw new Error(`Knowledge is not approved: ${name}`)
    const target = await fs.realpath(path.resolve(base, name))
    const relative = path.relative(base, target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Knowledge path outside approved folder')
    const text = await fs.readFile(target, 'utf8')
    if (Buffer.byteLength(text) > 50000) throw new Error('Knowledge file too large')
    const sha256 = digest(text)
    if (entry.sha256 !== sha256 || !entry.approved_by || !entry.approved_at) throw new Error(`Knowledge approval missing or stale: ${name}`)
    return { file: name, sha256, text }
  }))
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  const root = process.env.ASSETX_APPROVED_KB_DIR
  if (!root) throw new Error('Configure ASSETX_APPROVED_KB_DIR before using this workflow')
  const jobsDir = path.join(repo, '.local', 'firefly-jobs')
  if (command === 'stage' && args.length === 1) {
    console.log(JSON.stringify(await stageFireflyJob(JSON.parse(await fs.readFile(args[0], 'utf8')), root, jobsDir)))
    return
  }
  if (command === 'prepare') {
    const sources = await approvedSources(root, args)
    console.log(JSON.stringify({ success: true, sources, next: 'Draft content from these sources, then generate an image only with authorized cost. Submit with stable requestId.' }))
    return
  }
  if (!(command === 'submit' && args.length === 1) && !(command === 'attach' && args.length === 2)) throw new Error('Usage: prepare <approved.md> ... | stage <request.json> | attach <jobId> <imagePath> | submit <request.json>')
  const input = command === 'attach'
    ? { ...await readFireflyJob(jobsDir, args[0]), imagePath: args[1] }
    : JSON.parse(await fs.readFile(args[0], 'utf8'))
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(input.requestId || '')) throw new Error('Stable requestId required')
  const sources = await approvedSources(root, input.sources?.map((source) => source.file))
  if (sources.some((source, i) => source.sha256 !== input.sources[i].sha256)) throw new Error('Source changed since content was drafted')
  const website = new URL(process.env.ASSETX_MARKETING_SITE_URL || '')
  if (website.protocol !== 'https:' || website.username || website.password) throw new Error('HTTPS site URL required')
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !key) throw new Error('Local Supabase server credentials not configured')
  const imagePath = path.resolve(input.imagePath || '')
  const imageStat = await fs.stat(imagePath)
  if (!imageStat.isFile() || imageStat.size > 3 * 1024 * 1024 - 64) throw new Error('Provide an image file under 3MB')
  const bytes = await fs.readFile(imagePath)
  const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null
  if (!mime || bytes.length > 3 * 1024 * 1024) throw new Error('Provide a PNG/JPEG/WebP image under 3MB')
  const id = digest(input.requestId).slice(0, 32)
  const draft = validateHermesDraft({ ...input, version: 1, id, image: `data:image/${mime};base64,${bytes.toString('base64')}`, sources })
  const client = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const rowId = `hermes-draft-${id}`
  // Immutable inbox rows never overwrite the user's live default workspace.
  const result = await client.from('marketing_workspaces').insert({ id: rowId, payload: draft, updated_at: new Date().toISOString() })
  if (result.error && result.error.code !== '23505') throw new Error('Draft storage failed; no success link issued')
  const { data, error } = await client.from('marketing_workspaces').select('payload').eq('id', rowId).single()
  if (error || JSON.stringify(validateHermesDraft(data?.payload)) !== JSON.stringify(draft)) throw new Error('Draft verification failed or requestId already used for different content')
  website.pathname = '/marketing'
  website.search = new URLSearchParams({ hermesDraft: id }).toString()
  website.hash = ''
  console.log(JSON.stringify({ success: true, status: 'draft_inbox', id, reviewUrl: website.toString(), published: false }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(JSON.stringify({ success: false, error: error.message })); process.exitCode = 1 })
}
