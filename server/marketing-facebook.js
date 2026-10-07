import crypto from 'crypto'
import { verifySession } from '../api/_auth.js'
import { canPublishAssetxPost } from '../src/lib/assetxMarketingModel.js'

const DEFAULT_GRAPH_VERSION = 'v26.0'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MIN_SCHEDULE_DELAY_MS = 10 * 60 * 1000

function facebookConfig() {
  return {
    pageId: String(process.env.META_PAGE_ID || '').trim(),
    accessToken: String(process.env.META_PAGE_ACCESS_TOKEN || '').trim(),
    appSecret: String(process.env.META_APP_SECRET || '').trim(),
    appId: String(process.env.META_APP_ID || '').trim(),
    graphVersion: String(process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION).trim(),
  }
}

function configStatus(config = facebookConfig()) {
  const missing = []
  if (!config.pageId) missing.push('META_PAGE_ID')
  if (!config.accessToken) missing.push('META_PAGE_ACCESS_TOKEN')
  return { ready: missing.length === 0, missing }
}

function graphUrl(config, path) {
  return `https://graph.facebook.com/${config.graphVersion}/${path}`
}

function appSecretProof(config) {
  if (!config.appSecret) return ''
  return crypto.createHmac('sha256', config.appSecret).update(config.accessToken).digest('hex')
}

function addProofParam(params, config) {
  const proof = appSecretProof(config)
  if (proof) params.set('appsecret_proof', proof)
  return params
}

function graphHeaders(config, headers = {}) {
  return { ...headers, Authorization: `Bearer ${config.accessToken}` }
}

function cleanText(value = '') {
  return String(value || '').replace(/\r\n/g, '\n').trim()
}

export function parseScheduledAt(value, now = Date.now()) {
  const raw = String(value || '').trim()
  if (!raw) return null

  let normalized = raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) normalized = `${raw}T09:00:00+07:00`
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) normalized = `${raw}+07:00`

  const timestamp = new Date(normalized).getTime()
  if (!Number.isFinite(timestamp)) throw new Error('วันและเวลาที่จะโพสต์ไม่ถูกต้อง')
  if (timestamp < now + MIN_SCHEDULE_DELAY_MS) {
    throw new Error('กรุณาตั้งเวลาโพสต์ล่วงหน้าอย่างน้อย 10 นาที')
  }
  return {
    unix: Math.floor(timestamp / 1000),
    iso: new Date(timestamp).toISOString(),
  }
}

function addScheduleParams(params, schedule) {
  if (!schedule) return params
  params.set('published', 'false')
  params.set('scheduled_publish_time', String(schedule.unix))
  return params
}

export function parseImageDataUrl(dataUrl = '') {
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i)
  if (!match) throw new Error('รูปภาพต้องเป็นไฟล์ JPEG, PNG หรือ WebP')
  const mimeType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (!buffer.length) throw new Error('ไม่พบข้อมูลรูปภาพ')
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('รูปภาพมีขนาดเกิน 8 MB')
  return { mimeType, buffer }
}

function facebookError(data, status, config) {
  let message = String(data?.error?.message || data?.message || `Facebook Graph API ${status}`)
  for (const secret of [config.accessToken, config.appSecret, appSecretProof(config)]) {
    if (secret) message = message.replaceAll(secret, '[REDACTED]').replaceAll(encodeURIComponent(secret), '[REDACTED]')
  }
  const code = data?.error?.code
  const subcode = data?.error?.error_subcode
  const details = [`HTTP ${status}`]
  if (Number.isInteger(code)) details.push(`code ${code}`)
  if (Number.isInteger(subcode)) details.push(`subcode ${subcode}`)
  const diagnostic = `Facebook (${details.join(', ')}): ${message}`
  if (code === 190 || status === 401) {
    if (subcode === 463) return `โทเคน Facebook หมดอายุ ต้องออกโทเคนระยะยาวใหม่ การเข้าสู่ระบบ AssetX หรือ Redeploy ด้วยค่าเดิมไม่ต่ออายุโทเคน — ${diagnostic}`
    return `Page Access Token ใช้งานไม่ได้ กรุณาตรวจสอบโทเคน — ${diagnostic}`
  }
  if (code === 200 || status === 403) {
    return `Facebook ปฏิเสธคำขอ กรุณาตรวจสอบรายละเอียด — ${diagnostic}`
  }
  return diagnostic
}

async function graphRequest(url, options, fetchImpl, config) {
  const response = await fetchImpl(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.error) throw new Error(facebookError(data, response.status, config))
  return data
}

export async function getFacebookConnection(fetchImpl = fetch, config = facebookConfig()) {
  const status = configStatus(config)
  if (!status.ready) return { connected: false, missing: status.missing }

  const params = addProofParam(new URLSearchParams({ fields: 'id,name' }), config)
  const data = await graphRequest(
    `${graphUrl(config, config.pageId)}?${params.toString()}`,
    { method: 'GET', headers: graphHeaders(config) },
    fetchImpl,
    config,
  )
  const tokenHealth = await getTokenHealth(fetchImpl, config)
  return {
    connected: true,
    pageId: data.id || config.pageId,
    pageName: data.name || 'Facebook Page',
    graphVersion: config.graphVersion,
    tokenHealth,
  }
}

export function describeTokenHealth(data, now = Date.now()) {
  const dates = [data.expires_at, data.data_access_expires_at].map(Number).filter(value => Number.isFinite(value) && value > 0)
  const expiresAt = dates.length ? Math.min(...dates) * 1000 : null
  if (!data.is_valid || (expiresAt && expiresAt <= now)) return { state: 'expired', warning: 'โทเคนหมดอายุหรือถูกยกเลิก ต้องอนุญาตผ่าน Meta ใหม่' }
  const expiry = expiresAt ? new Date(expiresAt).toISOString() : null
  return {
    state: expiresAt && expiresAt - now < 7 * 86400000 ? 'expiring' : 'valid',
    expiresAt: expiry,
    warning: expiry
      ? `สิทธิ์โทเคนหมดอายุ ${new Date(expiresAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} (เวลาไทย) ควรใช้โทเคนระยะยาวสำหรับงานอัตโนมัติ`
      : 'Meta ไม่ระบุวันหมดอายุ แต่โทเคนยังอาจถูกเพิกถอนเมื่อสิทธิ์หรือความปลอดภัยเปลี่ยน',
  }
}

async function getTokenHealth(fetchImpl, config) {
  if (!config.appId || !config.appSecret) return { state: 'unknown', warning: 'ยังไม่ได้ตรวจอายุโทเคน ตั้งค่า META_APP_ID และ META_APP_SECRET เพื่อแสดงวันหมดอายุ การเชื่อมต่อสำเร็จไม่ได้ยืนยันว่าเป็นโทเคนระยะยาว' }
  try {
    const params = new URLSearchParams({ input_token: config.accessToken })
    const data = await graphRequest(`${graphUrl(config, 'debug_token')}?${params}`, {
      method: 'GET', headers: { Authorization: `Bearer ${config.appId}|${config.appSecret}` },
    }, fetchImpl, config)
    return describeTokenHealth(data.data || {})
  } catch {
    // Never expose diagnostic requests containing credentials to the browser.
    return { state: 'unknown', warning: 'ตรวจวันหมดอายุโทเคนไม่สำเร็จ กรุณาตรวจใน Access Token Debugger' }
  }
}

export async function publishFacebookPost(payload = {}, fetchImpl = fetch, config = facebookConfig()) {
  const status = configStatus(config)
  if (!status.ready) throw new Error(`ยังไม่ได้ตั้งค่า ${status.missing.join(', ')}`)

  const post = payload.post || {}
  const caption = cleanText(post.caption)
  const channel = /facebook/i.test(String(post.channel || '')) ? 'facebook' : String(post.channel || '')
  const publishCheck = canPublishAssetxPost({
    ...post,
    postId: post.facebookPostId,
    channel,
    status: post.status,
    caption,
  })
  if (!publishCheck.ok) throw new Error(publishCheck.reason)
  if (post.reviewStatus !== 'passed') throw new Error('โพสต์นี้ยังไม่ผ่านการตรวจเนื้อหา')
  if (!caption) throw new Error('กรุณากรอกข้อความโพสต์')
  const schedule = post.status === 'scheduled' ? parseScheduledAt(post.scheduledAt) : null
  if (post.status === 'scheduled' && !schedule) throw new Error('กรุณาระบุวันและเวลาที่จะโพสต์')

  const media = payload.media || null
  let result
  if (media?.dataUrl) {
    const image = parseImageDataUrl(media.dataUrl)
    const form = new FormData()
    form.set('caption', caption)
    addScheduleParams(form, schedule)
    const proof = appSecretProof(config)
    if (proof) form.set('appsecret_proof', proof)
    form.set('source', new Blob([image.buffer], { type: image.mimeType }), media.originalName || 'assetx-post.jpg')
    result = await graphRequest(
      graphUrl(config, `${config.pageId}/photos`),
      { method: 'POST', headers: graphHeaders(config), body: form },
      fetchImpl,
      config,
    )
  } else {
    const params = addProofParam(addScheduleParams(new URLSearchParams({ message: caption }), schedule), config)
    result = await graphRequest(
      graphUrl(config, `${config.pageId}/feed`),
      {
        method: 'POST',
        headers: graphHeaders(config, { 'Content-Type': 'application/x-www-form-urlencoded' }),
        body: params,
      },
      fetchImpl,
      config,
    )
  }

  const facebookPostId = result.post_id || result.id
  if (!facebookPostId) throw new Error('Facebook ไม่ได้ส่ง Post ID กลับมา')
  return {
    facebookPostId,
    mediaType: media?.dataUrl ? 'photo' : 'text',
    scheduled: Boolean(schedule),
    scheduledPublishTime: schedule?.iso || null,
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!verifySession(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await getFacebookConnection())
    }
    if (req.method === 'POST') {
      const result = await publishFacebookPost(req.body || {})
      return res.status(200).json({ success: true, ...result })
    }
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'เชื่อม Facebook ไม่สำเร็จ' })
  }
}
