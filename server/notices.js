import { createClient } from '@supabase/supabase-js'
import { verifySession } from '../api/_auth.js'
import { validateNotice } from '../src/lib/noticeTracking.js'
import { decodeReceipt, uploadReceipt, RECEIPT_BUCKET } from './noticeReceipt.js'

export function createNoticeHandler({ authorized = verifySession, database = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
} } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!authorized(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
    const db = database()
    if (!db) return res.status(503).json({ error: 'ระบบ Notice ยังไม่ได้ตั้งค่าฐานข้อมูลฝั่งเซิร์ฟเวอร์' })
    try {
      const url = new URL(req.url, 'http://localhost')
      const body = req.body || {}
      const customerId = req.method === 'GET' ? url.searchParams.get('customerId') : body.customerId
      if (typeof customerId !== 'string' || !customerId || customerId.length > 200) return res.status(400).json({ error: 'กรุณาระบุลูกค้า' })
      const customer = await db.from('customers').select('id').eq('id', customerId).maybeSingle()
      if (customer.error) throw customer.error
      if (!customer.data) return res.status(404).json({ error: 'ไม่พบลูกค้า' })
      if (req.method === 'GET' && url.searchParams.get('receiptId')) {
        const { data, error } = await db.from('notice_records').select('payload').eq('customer_id', customerId).eq('id', url.searchParams.get('receiptId')).maybeSingle()
        if (error) throw error
        if (!data?.payload?.receiptFile?.path) return res.status(404).json({ error: 'ไม่พบใบเสร็จ' })
        const signed = await db.storage.from(RECEIPT_BUCKET).createSignedUrl(data.payload.receiptFile.path, 60, { download: data.payload.receiptFile.name })
        if (signed.error) throw signed.error
        return res.status(200).json({ url: signed.data.signedUrl })
      }
      if (req.method === 'GET') {
        const { data, error } = await db.from('notice_records').select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json({ records: data })
      }
      let payload
      try { payload = validateNotice(body.payload || {}) } catch (error) { return res.status(400).json({ error: error.message }) }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id || '')) return res.status(400).json({ error: 'รหัสรายการไม่ถูกต้อง' })
      let file
      try { if (body.receiptUpload) file = decodeReceipt(body.receiptUpload) } catch (error) { return res.status(400).json({ error: error.message }) }
      if (req.method === 'PATCH') {
        const prior = await db.from('notice_records').select('payload,version').eq('id', body.id).eq('customer_id', customerId).maybeSingle()
        if (prior.error) throw prior.error
        if (!prior.data || prior.data.version !== body.version) return res.status(409).json({ error: 'รายการเปลี่ยนแปลงแล้ว กรุณาโหลดประวัติใหม่' })
        if (prior.data.payload.receiptFile) payload.receiptFile = prior.data.payload.receiptFile
      }
      const uploaded = file ? await uploadReceipt(db, body.id, file) : null
      if (uploaded) payload.receiptFile = uploaded
      let query
      if (req.method === 'POST') {
        query = db.from('notice_records').insert({ id: body.id, customer_id: customerId, payload })
      } else {
        if (!Number.isInteger(body.version) || body.version < 1) return res.status(400).json({ error: 'เวอร์ชันไม่ถูกต้อง' })
        query = db.from('notice_records').update({ payload, version: body.version + 1, updated_at: new Date().toISOString() }).eq('id', body.id).eq('customer_id', customerId).eq('version', body.version)
      }
      const { data, error } = await query.select().maybeSingle()
      if ((error || !data) && uploaded) await db.storage.from(RECEIPT_BUCKET).remove([uploaded.path]).catch(() => {})
      if (error?.code === '23505' || (!error && !data)) return res.status(409).json({ error: 'รายการเปลี่ยนแปลงแล้ว กรุณาโหลดประวัติใหม่ก่อนแก้ไข' })
      if (error) throw error
      return res.status(200).json({ record: data })
    } catch (error) {
      const missing = ['42P01', 'PGRST205'].includes(error.code)
      return res.status(missing ? 503 : 500).json({ error: missing ? 'ยังไม่ได้ติดตั้งตารางประวัติ Notice' : 'อ่านหรือบันทึก Notice ไม่สำเร็จ กรุณาลองใหม่' })
    }
  }
}

export default createNoticeHandler()
