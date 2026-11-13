// ที่เก็บคิวไอเดีย — Supabase (service role) หรือ dry-run (ไฟล์ JSON ใน .local/research) ด้วย interface เดียวกัน
// ทุกการเขียนทำซ้ำได้ (upsert on_conflict=external_key ignore-duplicates) · ไม่มี DELETE: หมดอายุ = status expired
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { needsFacts } from './enrich.js'

const DAY_MS = 86400000

export function missingTable(error) {
  return ['42P01', 'PGRST205'].includes(error?.code) || /relation .* does not exist|Could not find the table/i.test(String(error?.message || ''))
}

// มีมุมเล่าแล้วแต่บางมุมยังไม่มีร่างโพสต์ (angles[i].draft.caption) — เงื่อนไขเดียวกับ needsDraft ใน drafts.js แต่ไม่ import เพื่อให้ store ไม่ผูกกับ prompt
function lacksDraft(row) {
  return Array.isArray(row?.angles) && row.angles.length > 0 && row.angles.some((a) => a && !a.draft?.caption)
}

function cutoffFor(subtypes, subtype, purgeDays) {
  const maxAge = Number(subtypes?.[subtype]?.max_age_days || 0)
  return Math.max(Number(purgeDays) || 14, maxAge)
}

// แถวที่ควรตั้ง expired: อายุเกินเกณฑ์ของ subtype · event_date ยังไม่ถึง = ยังไม่หมดอายุ · มีคอนเทนต์อ้างถึง = ไม่แตะ
// · มี chosen_angle = เจ้าของเคยเลือกแล้วย้อนร่างกลับมาเป็นไอเดียเอง (unpick) → ไม่แตะ ให้เจ้าของตัดสินเอง (ร่างใหม่ หรือกด ทิ้ง)
// pageAudience = กลุ่มคนอ่านของเพจ (audience.js) — ไอเดียที่ติดป้ายกลุ่มแต่ไม่มีกลุ่มของเพจเลยหมดอายุทันที แม้เหตุการณ์ยังไม่ถึง
// (เจ้าของเลือกกลุ่ม A อย่างเดียว 9 พ.ย. 2569 · ไอเดียที่เจ้าของดึงกลับจากร่างยังไม่แตะ) · ไม่ส่ง = ไม่กรองกลุ่ม
export function planExpiry(rows, { subtypes = {}, purgeDays = 14, now = new Date(), referenced = new Set(), pageAudience = null } = {}) {
  const today = now.toISOString().slice(0, 10)
  const page = Array.isArray(pageAudience) && pageAudience.length ? pageAudience : null
  const out = []
  for (const row of rows) {
    if (row.status !== 'new') continue
    if (row.content_id || referenced.has(row.id)) continue
    if (row.chosen_angle) continue
    if (page && Array.isArray(row.audience) && row.audience.length && !row.audience.some((code) => page.includes(code))) { out.push(row.id); continue }
    if (row.event_date && row.event_date >= today) continue
    const ageDays = (now.getTime() - new Date(row.created_at).getTime()) / DAY_MS
    if (ageDays > cutoffFor(subtypes, row.subtype, purgeDays)) out.push(row.id)
  }
  return out
}

export function createSupabaseStore({ url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, log = () => {} } = {}) {
  if (!url || !key) throw new Error('ไม่มี VITE_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const ideas = () => db.from('marketing_ideas')

  async function all(query) {
    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  return {
    kind: 'supabase',
    // ไอเดียโปสเตอร์ประกาศบริการทุกสถานะ (offers.js หมุนหัวข้อจากวันที่สร้างล่าสุด)
    async offerRows() {
      return all(ideas().select('id,external_key,status,created_at').eq('subtype', 'offer').limit(2000))
    },
    async existing({ eventWindowDays = 7, now = new Date() } = {}) {
      const keys = new Set()
      const eventKeys = new Map()
      const queueCounts = new Map()
      const since = new Date(now.getTime() - (eventWindowDays + 1) * DAY_MS).toISOString()
      const rows = await all(ideas().select('external_key,event_key,status,source,subtype,created_at').limit(20000))
      for (const row of rows) {
        keys.add(row.external_key)
        if (row.event_key && row.created_at >= since) {
          const prev = eventKeys.get(row.event_key)
          if (!prev || prev < row.created_at) eventKeys.set(row.event_key, row.created_at)
        }
        if (row.status === 'new') {
          const laneKey = `${row.source}|${row.subtype}`
          queueCounts.set(laneKey, (queueCounts.get(laneKey) || 0) + 1)
        }
      }
      return { keys, eventKeys, queueCounts, total: rows.length }
    },
    async insertIdeas(rows) {
      if (!rows.length) return { inserted: 0, duplicates: 0 }
      const { data, error } = await ideas().upsert(rows, { onConflict: 'external_key', ignoreDuplicates: true }).select('external_key')
      if (error) throw error
      const inserted = (data || []).length
      return { inserted, duplicates: rows.length - inserted }
    },
    // ลิงก์ที่มีในตารางแล้ว (ทุก status) — ตัวเฝ้าเพจใช้กันเสนอโพสต์เดิมซ้ำแม้กุญแจต่างกัน
    async knownUrls(urls) {
      const list = [...new Set((urls || []).filter(Boolean))]
      if (!list.length) return new Set()
      const rows = await all(ideas().select('url').in('url', list))
      return new Set(rows.map((r) => r.url))
    },
    async expireOld({ subtypes, purgeDays, now = new Date(), pageAudience = null } = {}) {
      const rows = await all(ideas().select('id,status,subtype,created_at,event_date,content_id,chosen_angle,audience').eq('status', 'new'))
      let referenced = new Set()
      try {
        const refs = await all(db.from('marketing_content').select('idea_id').not('idea_id', 'is', null))
        referenced = new Set(refs.map((r) => r.idea_id))
      } catch (error) {
        if (!missingTable(error)) throw error
      }
      const ids = planExpiry(rows, { subtypes, purgeDays, now, referenced, pageAudience })
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await ideas().update({ status: 'expired', dismiss_reason: 'expired' }).in('id', ids.slice(i, i + 100))
        if (error) throw error
      }
      return { expired: ids.length, checked: rows.length }
    },
    async ideasNeedingAngles(limit = 20) {
      return all(ideas().select('id,source,source_label,subtype,title,summary,url,audience,event_date,score').eq('status', 'new').is('angles', null).order('score', { ascending: false }).limit(limit))
    },
    async saveAngles(id, angles) {
      const { error } = await ideas().update({ angles }).eq('id', id)
      if (error) throw error
    },
    // ไอเดียที่มีลิงก์แต่ยังไม่มีข้อเท็จจริงที่ถอดจากต้นทาง (enrich.js) — เรียงคะแนน · retry = ลองซ้ำที่เคยดึงไม่ได้
    async ideasNeedingFacts(limit = 15, { retry = false } = {}) {
      const rows = await all(ideas().select('id,source,source_label,subtype,title,summary,url,score').eq('status', 'new').not('url', 'is', null).order('score', { ascending: false }).limit(Math.max(limit * 3, 40)))
      return rows.filter((r) => needsFacts(r, { retry })).slice(0, limit)
    },
    async saveSummary(id, summary) {
      const { error } = await ideas().update({ summary }).eq('id', id)
      if (error) throw error
    },
    // ไอเดียที่มีมุมเล่าแล้วแต่บางมุมยังไม่มีร่างโพสต์ (drafts.js) — กรองใน JS เพราะเป็นเงื่อนไขใน jsonb
    async ideasNeedingDrafts(limit = 12) {
      const rows = await all(ideas().select('id,source,source_label,subtype,title,summary,url,audience,event_date,score,angles').eq('status', 'new').not('angles', 'is', null).order('score', { ascending: false }).limit(Math.max(limit * 3, 30)))
      return rows.filter(lacksDraft).slice(0, limit)
    },
    // ไอเดียที่ระบุเอง (drafts --id) — ไม่สนสถานะ แต่ต้องมีมุมเล่าแล้ว · ไอเดียที่ถูก dismiss/expired ก็ร่างได้ถ้าสั่งเอง (ใช้ทดสอบ)
    async ideasByIds(ids = []) {
      if (!ids.length) return []
      return all(ideas().select('id,status,source,source_label,subtype,title,summary,url,audience,event_date,score,angles').in('id', ids).not('angles', 'is', null))
    },
    async leadsRecent(weeks = 9, now = new Date()) {
      try {
        return await all(db.from('leads').select('received_at,channel,audience,service,property_type,service_area,amount_band,qualified,closed').gte('received_at', new Date(now.getTime() - weeks * 7 * DAY_MS).toISOString()))
      } catch (error) {
        if (missingTable(error)) return []
        throw error
      }
    },
    async stats() {
      const rows = await all(ideas().select('status,source,subtype,angles').limit(20000))
      const byStatus = {}
      const queue = {}
      let withAngles = 0
      let withDrafts = 0
      let newCount = 0
      for (const row of rows) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1
        if (row.status === 'new') {
          newCount += 1
          if (row.angles) withAngles += 1
          if (row.angles && !lacksDraft(row)) withDrafts += 1
          const k = `${row.source}/${row.subtype}`
          queue[k] = (queue[k] || 0) + 1
        }
      }
      return {
        total: rows.length, byStatus, queue,
        anglesCoverage: newCount ? Math.round((withAngles / newCount) * 100) : null,
        // % ของไอเดีย new ที่มีมุมเล่า ซึ่งทุกมุมมีร่างโพสต์แล้ว
        draftsCoverage: withAngles ? Math.round((withDrafts / withAngles) * 100) : null,
      }
    },
    async markLaneRuns() { /* สถานะเลนเก็บในไฟล์ state ฝั่ง CLI */ },
  }
}

// dry-run: อ่าน/เขียนไฟล์ JSON แทนฐานข้อมูล ใช้ทดสอบเลนก่อนรัน SQL หรือดูผลโดยไม่แตะ DB
export function createDryRunStore({ file, log = () => {} }) {
  let data = { ideas: [] }
  if (file && existsSync(file)) {
    try { data = JSON.parse(readFileSync(file, 'utf8')) } catch { data = { ideas: [] } }
  }
  const save = () => {
    if (!file) return
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
  }
  let nextId = data.ideas.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1
  return {
    kind: 'dry-run',
    file,
    async existing({ eventWindowDays = 7, now = new Date() } = {}) {
      const keys = new Set(data.ideas.map((r) => r.external_key))
      const eventKeys = new Map()
      const queueCounts = new Map()
      const since = new Date(now.getTime() - (eventWindowDays + 1) * DAY_MS).toISOString()
      for (const row of data.ideas) {
        if (row.event_key && row.created_at >= since) eventKeys.set(row.event_key, row.created_at)
        if (row.status === 'new') { const k = `${row.source}|${row.subtype}`; queueCounts.set(k, (queueCounts.get(k) || 0) + 1) }
      }
      return { keys, eventKeys, queueCounts, total: data.ideas.length }
    },
    async insertIdeas(rows) {
      let inserted = 0
      const keys = new Set(data.ideas.map((r) => r.external_key))
      for (const row of rows) {
        if (keys.has(row.external_key)) continue
        keys.add(row.external_key)
        data.ideas.push({ id: nextId++, angles: null, created_at: new Date().toISOString(), ...row })
        inserted += 1
      }
      save()
      return { inserted, duplicates: rows.length - inserted }
    },
    async knownUrls(urls) {
      const want = new Set((urls || []).filter(Boolean))
      return new Set(data.ideas.map((r) => r.url).filter((u) => want.has(u)))
    },
    async expireOld({ subtypes, purgeDays, now = new Date(), pageAudience = null } = {}) {
      const ids = planExpiry(data.ideas, { subtypes, purgeDays, now, pageAudience })
      for (const row of data.ideas) if (ids.includes(row.id)) { row.status = 'expired'; row.dismiss_reason = 'expired' }
      save()
      return { expired: ids.length, checked: data.ideas.filter((r) => r.status === 'new').length }
    },
    async ideasNeedingAngles(limit = 20) {
      return data.ideas.filter((r) => r.status === 'new' && !r.angles).sort((a, b) => b.score - a.score).slice(0, limit)
    },
    async ideasNeedingDrafts(limit = 12) {
      return data.ideas.filter((r) => r.status === 'new' && lacksDraft(r)).sort((a, b) => b.score - a.score).slice(0, limit)
    },
    async ideasByIds(ids = []) {
      return data.ideas.filter((r) => ids.includes(r.id) && Array.isArray(r.angles) && r.angles.length)
    },
    async ideasNeedingFacts(limit = 15, { retry = false } = {}) {
      return data.ideas.filter((r) => r.status === 'new' && needsFacts(r, { retry })).sort((a, b) => b.score - a.score).slice(0, limit)
    },
    async saveSummary(id, summary) {
      const row = data.ideas.find((r) => r.id === id)
      if (row) row.summary = summary
      save()
    },
    async saveAngles(id, angles) {
      const row = data.ideas.find((r) => r.id === id)
      if (row) row.angles = angles
      save()
    },
    async leadsRecent() { return [] },
    async stats() {
      const byStatus = {}
      const queue = {}
      for (const row of data.ideas) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1
        if (row.status === 'new') { const k = `${row.source}/${row.subtype}`; queue[k] = (queue[k] || 0) + 1 }
      }
      return { total: data.ideas.length, byStatus, queue, anglesCoverage: null }
    },
  }
}
