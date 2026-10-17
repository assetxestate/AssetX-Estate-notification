export const marketingChannelSetup = [
  {
    id: 'facebook',
    label: 'Facebook Page',
    managerUrl: 'https://business.facebook.com/',
    preparation: 'ใช้เพจ AssetX Estate และสิทธิ์ผู้ดูแล Meta ที่เชื่อมอยู่แล้ว',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    managerUrl: 'https://www.instagram.com/',
    preparation: 'บัญชี Professional (Business หรือ Creator) และเชื่อมกับ Facebook Page สำหรับการต่อ API',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    managerUrl: 'https://www.tiktok.com/',
    preparation: 'บัญชีแบรนด์และวิดีโอแนวตั้ง; หากจะโพสต์ผ่าน API ต้องมี TikTok Developer App ที่ผ่านการอนุมัติ',
  },
  {
    id: 'youtube-shorts',
    label: 'YouTube Shorts',
    managerUrl: 'https://studio.youtube.com/',
    preparation: 'ช่อง YouTube ของบริษัทและสิทธิ์จัดการ; หากจะอัปโหลดผ่าน API ต้องอนุญาต OAuth',
  },
  {
    id: 'line-oa',
    label: 'LINE OA',
    managerUrl: 'https://manager.line.biz/',
    preparation: 'ยืนยัน OA สำหรับการตลาดและผู้ติดตามที่รับข้อความได้ แยกจากช่องแจ้งเตือนลูกค้า',
  },
]

const publicationPaths = {
  instagram: /^\/(?:p|reel|tv)\/[^/]+\/?$/,
  tiktok: /^\/@[^/]+\/(?:video|photo)\/[^/]+\/?$/,
  'youtube-shorts': /^\/(?:shorts\/[^/]+|watch)\/?$/,
}

export function validateManualPublicationReference(channel, value) {
  const reference = String(value || '').trim()
  if (channel === 'line-oa') {
    return reference.length >= 6 && reference.length <= 200
      ? { ok: true, reference }
      : { ok: false, error: 'กรุณาระบุรหัสหรือหลักฐานการส่งจาก LINE OA อย่างน้อย 6 ตัวอักษร' }
  }
  if (!publicationPaths[channel]) return { ok: false, error: 'ช่องทางนี้ไม่รองรับการบันทึกโพสต์ด้วยตนเอง' }

  let url
  try { url = new URL(reference) } catch { return { ok: false, error: 'กรุณาวางลิงก์โพสต์ที่เปิดดูได้' } }
  if (url.protocol !== 'https:') return { ok: false, error: 'ลิงก์โพสต์ต้องขึ้นต้นด้วย https://' }
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  const validHost = channel === 'instagram' ? host === 'instagram.com'
    : channel === 'tiktok' ? host === 'tiktok.com'
      : host === 'youtube.com' || host === 'youtu.be'
  const validPath = host === 'youtu.be' && channel === 'youtube-shorts'
    ? /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    : publicationPaths[channel].test(url.pathname) && (channel !== 'youtube-shorts' || url.pathname !== '/watch' || url.searchParams.has('v'))
  if (!validHost || !validPath) return { ok: false, error: 'ลิงก์ไม่ตรงกับโพสต์ของช่องทางที่เลือก' }
  return { ok: true, reference: url.toString() }
}
