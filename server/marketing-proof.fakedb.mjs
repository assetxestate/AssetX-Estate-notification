// ฐานข้อมูลจำลองในหน่วยความจำ: รองรับรูปแบบคำสั่งที่ server/marketing-proof.js ใช้ · ข้อมูลสมมติทั้งหมด
const TABLES = ['marketing_content_briefs', 'marketing_evidence_sources', 'marketing_proof_claims', 'marketing_claim_sources', 'marketing_content_reviews', 'marketing_brief_jobs', 'marketing_image_worker']
const DEFAULTS = {
  marketing_content_briefs: { content_id: null, content_no: null, brand_id: 'assetx_estate', topic: '', audience: '', objective: '', input: {}, version: 1, created_by: '' },
  marketing_evidence_sources: { kind: 'other', title: '', source_url: '', asset_ref: '', source_date: null, checked_at: null, permission_status: 'unknown', visibility: 'public', metadata: {}, version: 1 },
  marketing_proof_claims: { claim_type: 'NEEDS-CHECK', category: 'general', status: 'draft', limitation: '', publishable_wording: '', permission_status: 'unknown', use_in_post: true, reviewer: '', reviewed_at: null, expires_at: null, version: 1 },
  marketing_claim_sources: { evidence_note: '' },
  marketing_brief_jobs: { status: 'queued', request: {}, result: null, error: null, worker: null, claimed_at: null, finished_at: null },
  marketing_image_worker: {},
  marketing_content_reviews: { content_no: null, brief_id: null, category: 'publish', blockers: [], warnings: [], claim_ids: [], reviewer: '', reason: '' },
}
export function fakeDb({ missing = false, missingJobs = false } = {}) {
  const tables = Object.fromEntries(TABLES.map((name) => [name, []]))
  const seq = Object.fromEntries(TABLES.map((name) => [name, 1]))
  const from = (name) => {
    const q = { op: 'select', payload: null, filters: [], limitN: null, orderKey: null, asc: true, single: false }
    const run = () => {
      if (missing || (missingJobs && name === 'marketing_brief_jobs')) return { data: null, error: { code: '42P01', message: 'relation does not exist' } }
      if (q.op === 'insert') {
        const rows = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((row) => {
          if (name === 'marketing_content_briefs' && row.content_id && tables[name].some((r) => r.content_id === row.content_id)) return null
          const full = { ...(name === 'marketing_claim_sources' ? {} : { id: seq[name]++ }), created_at: '2026-11-23T05:00:00Z', ...DEFAULTS[name], ...row }
          tables[name].push(full)
          return full
        })
        if (rows.includes(null)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
        return { data: q.single ? rows[0] : rows, error: null }
      }
      let rows = tables[name].filter((r) => q.filters.every((f) => f(r)))
      if (q.op === 'update') { rows.forEach((r) => Object.assign(r, q.payload)); return { data: q.single ? rows[0] || null : rows, error: null } }
      if (q.op === 'delete') { tables[name] = tables[name].filter((r) => !rows.includes(r)); return { data: null, error: null } }
      if (q.orderKey) rows = [...rows].sort((a, b) => (a[q.orderKey] < b[q.orderKey] ? -1 : 1) * (q.asc ? 1 : -1))
      if (q.limitN) rows = rows.slice(0, q.limitN)
      return { data: q.single ? rows[0] || null : rows, error: null }
    }
    const api = {
      select: () => api,
      insert: (row) => { q.op = 'insert'; q.payload = row; return api },
      update: (patch) => { q.op = 'update'; q.payload = patch; return api },
      delete: () => { q.op = 'delete'; return api },
      eq: (k, v) => { q.filters.push((r) => r[k] === v); return api },
      in: (k, list) => { q.filters.push((r) => list.map(String).includes(String(r[k]))); return api },
      order: (k, o) => { q.orderKey = k; q.asc = o?.ascending !== false; return api },
      limit: (n) => { q.limitN = n; return api },
      maybeSingle: () => { q.single = true; return Promise.resolve(run()) },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }
  return { from, tables: () => tables }
}
