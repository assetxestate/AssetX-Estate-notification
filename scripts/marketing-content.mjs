#!/usr/bin/env node
// scripts/marketing-content.mjs — หาคอนเทนต์การตลาดจากเลขกำกับ (#12) ที่เจ้าของหรือทีมอ้างถึงตอนสั่งแก้ · อ่านอย่างเดียว
// อ่านเวิร์กสเปซหน้า /marketing (ตาราง marketing_workspaces แถว default) ด้วย SUPABASE_SERVICE_ROLE_KEY จาก .env.local
//
// node scripts/marketing-content.mjs list          รายการคอนเทนต์ทั้งหมด: เลข · สถานะ · ช่องทาง · วันที่สร้าง · หัวข้อ
// node scripts/marketing-content.mjs show <เลข>    รายละเอียดคอนเทนต์ชิ้นนั้น (รับ 12 · #12 · "คอนเทนต์ 12")
//
// ไม่เขียนกลับเด็ดขาด: หน้าเว็บบันทึกเวิร์กสเปซทั้งก้อนทับทุกครั้งที่มีการแก้ ถ้าสคริปต์เขียนระหว่างที่หน้าเปิดอยู่ การแก้ของสคริปต์จะหายเงียบ ๆ
// → แก้คอนเทนต์ที่หน้า /marketing เสมอ (สคริปต์นี้ใช้หาว่า "#12 คือชิ้นไหน" และอ่านข้อความเดิมก่อนเสนอข้อความใหม่)
// คอนเทนต์การตลาดไม่มีข้อมูลลูกค้า · สคริปต์ไม่พิมพ์คีย์ ภาพ (data URL) หรือรหัสโพสต์ Facebook
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureContentNumbers, findContentByNo, formatContentNo, parseContentNo } from '../src/lib/marketingContentNumbers.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(repo, '.env.local'), quiet: true })
config({ path: path.join(repo, '.env'), quiet: true })

const STATUS = { draft: 'รอตรวจ', pending: 'รอตรวจ', needs_edit: 'รอตรวจ', approved: 'อนุมัติแล้ว', scheduled: 'ตั้งเวลาแล้ว', posted: 'โพสต์แล้ว', archived: 'พักไว้' }
const out = (text = '') => process.stdout.write(`${text}\n`)
const die = (message) => { console.error(message); process.exit(1) }
const day = (iso) => {
  const t = new Date(iso || '')
  return Number.isNaN(t.getTime()) ? '-' : t.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadWorkspace() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) die('ไม่มี VITE_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await db.from('marketing_workspaces').select('payload,updated_at').eq('id', 'default').maybeSingle()
  if (error) die(`อ่านเวิร์กสเปซไม่สำเร็จ (${error.code || 'error'})`)
  if (!data?.payload) die('ยังไม่มีเวิร์กสเปซของหน้า /marketing')
  const saved = data.payload
  const numbered = ensureContentNumbers({ ...saved, posts: Array.isArray(saved.posts) ? saved.posts : [] })
  if ((saved.posts || []).some((post) => post && !String(post.id ?? '').startsWith('sample-') && !Number.isSafeInteger(post.contentNo))) {
    out('⚠️ คอนเทนต์บางชิ้นยังไม่มีเลขในระบบ (ยังไม่มีใครเปิดหน้า /marketing ตั้งแต่อัปเดต) — เลขด้านล่างคำนวณแบบเดียวกับหน้าเว็บ จะตรงกันเมื่อเปิดหน้าแล้ว')
  }
  return { workspace: numbered, updatedAt: data.updated_at }
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'list') {
  const { workspace, updatedAt } = await loadWorkspace()
  const posts = (workspace.posts || []).filter((post) => post?.contentNo).sort((a, b) => a.contentNo - b.contentNo)
  out(`คอนเทนต์ ${posts.length} ชิ้น · เลขล่าสุด ${formatContentNo(workspace.contentSeq) || '-'} · บันทึกล่าสุด ${day(updatedAt)}`)
  for (const post of posts) {
    out(`${formatContentNo(post.contentNo).padEnd(5)} ${(STATUS[post.status] || post.status || '-').padEnd(12)} ${String(post.channel || '-').padEnd(9)} ${day(post.createdAt).padEnd(18)} ${String(post.title || '').slice(0, 70)}`)
  }
} else if (cmd === 'show') {
  const wanted = parseContentNo(args.join(' '))
  if (!wanted) die('ใส่เลขคอนเทนต์ เช่น: node scripts/marketing-content.mjs show 12')
  const { workspace } = await loadWorkspace()
  const post = findContentByNo(workspace.posts, wanted)
  if (!post) die(wanted <= (workspace.contentSeq || 0) ? `ไม่พบคอนเทนต์ #${wanted} — อาจถูกลบไปแล้ว` : `ยังไม่มีคอนเทนต์ #${wanted} — เลขล่าสุดคือ ${formatContentNo(workspace.contentSeq) || '-'}`)
  const media = (workspace.mediaAssets || []).some((asset) => asset?.id && asset.id === post.mediaAssetId)
  out(`คอนเทนต์ ${formatContentNo(post.contentNo)} · ${post.title || '(ไม่มีหัวข้อ)'}`)
  out(`สถานะ: ${STATUS[post.status] || post.status || '-'} · ผลตรวจเกณฑ์: ${post.reviewStatus === 'passed' ? 'ผ่านเกณฑ์' : 'ติดเกณฑ์'} · ช่องทาง: ${post.channel || '-'}`)
  out(`สร้าง: ${day(post.createdAt)} · กำหนดโพสต์: ${day(post.scheduledAt)} · โพสต์แล้ว: ${day(post.postedAt)}`)
  out(`ที่มา: ${post.source || '-'}${post.ideaId ? ` · จากไอเดีย ${post.ideaId} (ตาราง marketing_ideas)` : ''}${post.sampleOf ? ' · แก้มาจากร่างตัวอย่าง' : ''}`)
  out(`ภาพแนบ: ${media ? 'มี' : 'ไม่มี'} · ส่ง Facebook แล้ว: ${post.facebookPostId ? 'ใช่' : 'ยัง'}`)
  if (post.topic && post.topic !== post.title) out(`หัวข้อต้นทาง: ${post.topic}`)
  if (Array.isArray(post.reviewNotes) && post.reviewNotes.length) out(`โน้ตตรวจ: ${[...new Set(post.reviewNotes)].join(' · ')}`)
  out('\n── แคปชั่น ──')
  out(post.caption || '(ว่าง)')
  if (post.imagePrompt) {
    out('\n── บรีฟรูป ──')
    out(String(post.imagePrompt).slice(0, 1200))
  }
} else {
  out('ใช้: node scripts/marketing-content.mjs list | show <เลข>')
  process.exit(cmd ? 1 : 0)
}
