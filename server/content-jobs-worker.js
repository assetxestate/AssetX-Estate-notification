// ฝั่งตัวรับงานของคิว "คิดคอนเทนต์ใหม่ด้วย AI" (ตาราง marketing_content_jobs) — scripts/image-worker.mjs เรียกเป็นลูปที่สองคู่กับคิวภาพ
// หยิบงาน → อ่านไอเดีย → generate (server/research/fresh.js ผ่าน Codex) → วางมุมใหม่ไว้ช่องแรกของ marketing_ideas.angles → งาน done พร้อมมุมใหม่ในผล
// แยกไฟล์จากสคริปต์ตัวรับงานให้เทสต์ได้โดยไม่เรียก AI จริง (generate ส่งมาจากผู้เรียก)
import { scrub } from './research/pii.js'

export const CONTENT_JOB_TABLE = 'marketing_content_jobs'
const IDEA_COLUMNS = 'id,status,title,summary,url,source,source_label,subtype,audience,event_date,angles'
// ตารางยังไม่มี (ยังไม่ได้รัน supabase_marketing_content_jobs.sql) — ตัวรับงานพักลูปนี้ไว้ ไม่กระทบคิวภาพ
export const isMissingTable = (error) => ['42P01', 'PGRST205'].includes(error?.code)
const shortError = (err) => scrub(String(err?.message || err || 'ไม่ทราบสาเหตุ')).replace(/\s+/g, ' ').trim().slice(0, 300)

// งานที่ค้าง running จากรอบก่อน (คอมดับ/ปิดตัวรับงานกลางคัน) → failed ให้หน้าเว็บสั่งใหม่ได้
export async function releaseStaleContentJobs(db, workerId) {
  const { data, error } = await db.from(CONTENT_JOB_TABLE)
    .update({ status: 'failed', error: 'ตัวรับงานบนคอมหยุดกลางคัน กดคิดใหม่ได้', finished_at: new Date().toISOString() })
    .eq('status', 'running').eq('worker', workerId).select('id')
  if (error) throw error
  return data?.length || 0
}

export async function claimNextContentJob(db, workerId) {
  const { data, error } = await db.from(CONTENT_JOB_TABLE).select('id').eq('status', 'queued').order('created_at', { ascending: true }).limit(1)
  if (error) throw error
  const next = data?.[0]
  if (!next) return null
  const claimed = await db.from(CONTENT_JOB_TABLE)
    .update({ status: 'running', claimed_at: new Date().toISOString(), worker: workerId })
    .eq('id', next.id).eq('status', 'queued')
    .select('id,idea_id,post_key,content_no,request').maybeSingle()
  if (claimed.error) throw claimed.error
  return claimed.data // null = หน้าเว็บยกเลิกไปก่อนหยิบทัน
}

// generate({ idea, avoid, note }) → { ok, angle, provider, error } (ผู้เรียกผูก brand/ask/คลังความรู้/hook ไว้แล้ว)
// คืน { ok, error?, seconds } · ไม่ throw — งานล้มทุกแบบลงเป็น failed พร้อมเหตุผลสั้น ๆ ให้หน้าเว็บบอกเจ้าของ
export async function processContentJob(db, job, { generate, log = () => {}, now = () => new Date() }) {
  const label = `คิดคอนเทนต์ใหม่ งาน ${job.id} (ไอเดีย ${job.idea_id}${job.content_no ? ` · #${job.content_no}` : ''})`
  const started = Date.now()
  log(`${label}: เริ่ม`)
  try {
    const found = await db.from('marketing_ideas').select(IDEA_COLUMNS).eq('id', job.idea_id).maybeSingle()
    if (found.error) throw found.error
    if (!found.data || !['new', 'picked'].includes(found.data.status)) throw new Error('ไอเดียนี้ถูกทิ้งหรือหมดอายุไปแล้ว')
    const request = job.request && typeof job.request === 'object' ? job.request : {}
    const out = await generate({ idea: found.data, avoid: Array.isArray(request.avoid) ? request.avoid : [], note: request.note || '' })
    if (!out?.ok || !out.angle?.draft?.caption) throw new Error(out?.error || 'AI ไม่ได้ส่งร่างกลับมา')
    // อ่าน angles ล่าสุดอีกครั้งก่อนบันทึก — ระหว่างที่ AI คิด (1–3 นาที) รอบรีเสิร์ชอาจเขียนร่างของมุมอื่นลงแถวเดียวกัน · มุมใหม่อยู่ช่องแรก (การ์ดเลือกช่องแรกให้เอง)
    const latest = await db.from('marketing_ideas').select('id,angles').eq('id', job.idea_id).maybeSingle()
    if (latest.error) throw latest.error
    const current = Array.isArray(latest.data?.angles) ? latest.data.angles : []
    const angles = [out.angle, ...current.filter((a) => a?.label !== out.angle.label)]
    const saved = await db.from('marketing_ideas').update({ angles }).eq('id', job.idea_id).select('id').maybeSingle()
    if (saved.error) throw saved.error
    const done = await db.from(CONTENT_JOB_TABLE)
      .update({ status: 'done', result: { angle_index: 0, angle: out.angle, provider: out.provider || null }, error: null, finished_at: now().toISOString() })
      .eq('id', job.id).select('id').maybeSingle()
    if (done.error) throw done.error
    const seconds = Math.round((Date.now() - started) / 1000)
    log(`${label}: เสร็จใน ${seconds} วินาที · ร่าง ${out.angle.draft.caption.length} ตัวอักษร (${out.provider || 'AI'})`)
    return { ok: true, seconds }
  } catch (err) {
    const message = shortError(err)
    log(`${label}: ไม่สำเร็จ — ${message}`)
    await db.from(CONTENT_JOB_TABLE).update({ status: 'failed', error: message, finished_at: now().toISOString() }).eq('id', job.id)
    return { ok: false, error: message }
  }
}
