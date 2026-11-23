// รูปของหน้า /marketing เก็บเป็นไฟล์แยกในที่เก็บไฟล์ปิด แทนการฝังในก้อนเวิร์กสเปซ (เจ้าของสั่ง 23 พ.ย. 2569) — ตรรกะล้วน
// ทำไม: ก้อนเวิร์กสเปซ 5.9 MB (รูป 8 รูป = 5.3 MB) ถูกส่งขึ้นระบบทั้งก้อนทุกครั้งที่แก้ จึงบันทึกล้มเป็นบางครั้ง และสำเนาในเบราว์เซอร์เกินโควตา
//
// รูปหนึ่งรายการมีรูปฝังได้สองช่อง: dataUrl (ภาพที่ใช้โพสต์) และ sourceDataUrl (ภาพต้นทางของตัวออกแบบภาพ ใช้ตอนกดแก้ไขภาพ)
//   ทั้งสองช่องย้ายแบบเดียวกัน ช่องละตำแหน่งไฟล์ (storagePath · sourceStoragePath) — รอบแรกย้ายแต่ dataUrl ก้อนจึงยังเหลือ 2.8 MB
//
// วิธี (ไม่แตะโค้ดส่วนที่ใช้รูป):
//   - ในหน่วยความจำ รูปยังอยู่ครบเหมือนเดิม ทุกที่ที่แสดง/ส่ง/แก้รูปทำงานแบบเดิม
//   - ตอนบันทึก (ขึ้นระบบและลงเบราว์เซอร์) ช่องที่มีตำแหน่งไฟล์แล้วถูกตัดรูปออก (dehydrate) เหลือแค่ตำแหน่งไฟล์
//   - ตอนเปิดหน้า ช่องที่มีตำแหน่งไฟล์แต่ไม่มีรูปถูกดึงกลับมาใส่ในหน่วยความจำ (hydrate)
//   - รูปใหม่ (มีรูป ยังไม่มีตำแหน่งไฟล์) ถูกอัปโหลด → อ่านกลับมาเทียบว่าตรงกับต้นฉบับ → จึงได้ตำแหน่งไฟล์
//     อัปโหลดไม่สำเร็จหรืออ่านกลับไม่ตรง = รูปยังอยู่ในก้อนแบบเดิม (ไม่มีทางที่รูปหายเพราะย้ายไม่สำเร็จ)
export const MEDIA_MAX_BYTES = 3 * 1024 * 1024 // เพดานคำขอของเซิร์ฟเวอร์ 4.5 MB (base64 ใหญ่กว่าไฟล์จริงราวหนึ่งในสาม) · ใหญ่กว่านี้อยู่ในก้อนต่อไป
export const MEDIA_FIELDS = [
  { data: 'dataUrl', path: 'storagePath', suffix: '' },
  { data: 'sourceDataUrl', path: 'sourceStoragePath', suffix: '-src' },
]
const STORAGE_PATH = /^workspace\/[A-Za-z0-9._-]{1,160}$/

export const isStoragePath = (value) => typeof value === 'string' && STORAGE_PATH.test(value)
const isImage = (value) => typeof value === 'string' && value.startsWith('data:image/')
const fieldOf = (data) => MEDIA_FIELDS.find((field) => field.data === data) || MEDIA_FIELDS[0]

// เนื้อ base64 ของรูป (ไม่มีหัว data: ไม่มีช่องว่าง) — ใช้เทียบว่ารูปที่อ่านกลับมาคือรูปเดิม
export function imagePayload(dataUrl) {
  const text = String(dataUrl ?? '')
  const comma = text.indexOf(',')
  return comma < 0 ? '' : text.slice(comma + 1).replace(/\s+/g, '')
}
export const imageBytes = (dataUrl) => {
  const payload = imagePayload(dataUrl)
  return Math.max(0, Math.floor((payload.length * 3) / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0))
}
export const sameImage = (a, b) => { const left = imagePayload(a); return left.length > 0 && left === imagePayload(b) }

// งานที่ต้องทำกับรูปหนึ่งรายการ: [{ kind: 'load' | 'upload', field, pathKey, key, path?, dataUrl?, uploadId? }]
export function mediaTasks(asset) {
  if (!asset?.id) return []
  const tasks = []
  for (const field of MEDIA_FIELDS) {
    const image = asset[field.data]
    const path = asset[field.path]
    const base = { field: field.data, pathKey: field.path, key: `${asset.id}:${field.data}` }
    if (isStoragePath(path) && !isImage(image)) tasks.push({ ...base, kind: 'load', path })
    else if (isImage(image) && !isStoragePath(path) && imageBytes(image) <= MEDIA_MAX_BYTES) tasks.push({ ...base, kind: 'upload', dataUrl: image, uploadId: `${asset.id}${field.suffix}` })
  }
  return tasks
}
export const needsUpload = (asset) => mediaTasks(asset).some((task) => task.kind === 'upload')
export const needsHydration = (asset) => mediaTasks(asset).some((task) => task.kind === 'load')

// สำเนาสำหรับบันทึก: ช่องที่อยู่ในที่เก็บไฟล์แล้วไม่ต้องพกรูป · ไม่แก้ object เดิม · ช่องที่ยังไม่ได้ย้ายคงเดิม
export function dehydrateWorkspace(workspace) {
  if (!workspace || !Array.isArray(workspace.mediaAssets)) return workspace
  const strippable = (asset) => MEDIA_FIELDS.some((field) => isStoragePath(asset?.[field.path]) && asset[field.data] !== undefined)
  if (!workspace.mediaAssets.some(strippable)) return workspace
  return {
    ...workspace,
    mediaAssets: workspace.mediaAssets.map((asset) => {
      if (!strippable(asset)) return asset
      const copy = { ...asset }
      for (const field of MEDIA_FIELDS) if (isStoragePath(copy[field.path])) delete copy[field.data]
      return copy
    }),
  }
}

// ใส่รูปที่ดึงกลับมาลงในเวิร์กสเปซ: loaded = { [assetId]: { storagePath, dataUrl } } หรือ { sourceStoragePath, sourceDataUrl }
// เฉพาะช่องที่ยังไม่มีรูปและตำแหน่งไฟล์ยังตรง · ไม่มีอะไรเปลี่ยน = คืน object เดิม
export function hydrateWorkspace(workspace, loaded = {}) {
  if (!workspace || !Array.isArray(workspace.mediaAssets)) return workspace
  let changed = false
  const mediaAssets = workspace.mediaAssets.map((asset) => {
    const hit = loaded[asset?.id]
    if (!hit) return asset
    let next = asset
    for (const field of MEDIA_FIELDS) {
      if (!isStoragePath(hit[field.path]) || asset[field.path] !== hit[field.path] || isImage(asset[field.data]) || !isImage(hit[field.data])) continue
      next = { ...next, [field.data]: hit[field.data] }
      changed = true
    }
    return next
  })
  return changed ? { ...workspace, mediaAssets } : workspace
}

// บันทึกตำแหน่งไฟล์ของรูปที่อัปโหลดและตรวจแล้ว (เฉพาะเมื่อรูปในช่องนั้นยังเป็นรูปเดิม — ระหว่างรออาจถูกแทนด้วยรูปใหม่)
export function markStored(workspace, assetId, storagePath, originalDataUrl, dataField = 'dataUrl') {
  if (!workspace || !Array.isArray(workspace.mediaAssets) || !isStoragePath(storagePath)) return workspace
  const field = fieldOf(dataField)
  let changed = false
  const mediaAssets = workspace.mediaAssets.map((asset) => {
    if (asset?.id !== assetId || isStoragePath(asset[field.path]) || !sameImage(asset[field.data], originalDataUrl)) return asset
    changed = true
    return { ...asset, [field.path]: storagePath }
  })
  return changed ? { ...workspace, mediaAssets } : workspace
}

// สรุปสถานะรูป (นับเป็นช่องรูป): ย้ายแล้ว · รอย้าย · รอโหลด · ใหญ่เกินจึงอยู่ในก้อน
export function mediaSummary(workspace) {
  const assets = Array.isArray(workspace?.mediaAssets) ? workspace.mediaAssets : []
  const slots = assets.flatMap((asset) => MEDIA_FIELDS.map((field) => ({ image: asset?.[field.data], path: asset?.[field.path] })).filter((slot) => isImage(slot.image) || isStoragePath(slot.path)))
  return {
    total: assets.length,
    stored: slots.filter((slot) => isStoragePath(slot.path)).length,
    pendingUpload: slots.filter((slot) => isImage(slot.image) && !isStoragePath(slot.path) && imageBytes(slot.image) <= MEDIA_MAX_BYTES).length,
    pendingLoad: slots.filter((slot) => isStoragePath(slot.path) && !isImage(slot.image)).length,
    tooLarge: slots.filter((slot) => isImage(slot.image) && !isStoragePath(slot.path) && imageBytes(slot.image) > MEDIA_MAX_BYTES).length,
  }
}
