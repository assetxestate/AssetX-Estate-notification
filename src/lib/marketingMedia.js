// รูปของหน้า /marketing เก็บเป็นไฟล์แยกในที่เก็บไฟล์ปิด แทนการฝังในก้อนเวิร์กสเปซ (เจ้าของสั่ง 23 พ.ย. 2569) — ตรรกะล้วน
// ทำไม: ก้อนเวิร์กสเปซ 5.9 MB (รูป 8 รูป = 5.3 MB) ถูกส่งขึ้นระบบทั้งก้อนทุกครั้งที่แก้ จึงบันทึกล้มเป็นบางครั้ง และสำเนาในเบราว์เซอร์เกินโควตา
//
// วิธี (ไม่แตะโค้ดส่วนที่ใช้รูป):
//   - ในหน่วยความจำ รูปยังมี dataUrl เหมือนเดิม ทุกที่ที่แสดง/ส่งรูปทำงานแบบเดิม
//   - ตอนบันทึก (ขึ้นระบบและลงเบราว์เซอร์) รูปที่มี storagePath แล้วถูกตัด dataUrl ออก (dehydrate) เหลือแค่ตำแหน่งไฟล์
//   - ตอนเปิดหน้า รูปที่มี storagePath แต่ไม่มี dataUrl ถูกดึงกลับมาใส่ในหน่วยความจำ (hydrate)
//   - รูปใหม่ (มี dataUrl ยังไม่มี storagePath) ถูกอัปโหลด → อ่านกลับมาเทียบว่าตรงกับต้นฉบับ → จึงได้ storagePath
//     อัปโหลดไม่สำเร็จหรืออ่านกลับไม่ตรง = รูปยังอยู่ในก้อนแบบเดิม (ไม่มีทางที่รูปหายเพราะย้ายไม่สำเร็จ)
export const MEDIA_MAX_BYTES = 3 * 1024 * 1024 // เพดานคำขอของเซิร์ฟเวอร์ 4.5 MB (base64 ใหญ่กว่าไฟล์จริงราวหนึ่งในสาม) · ใหญ่กว่านี้อยู่ในก้อนต่อไป
const STORAGE_PATH = /^workspace\/[A-Za-z0-9._-]{1,160}$/

export const isStoragePath = (value) => typeof value === 'string' && STORAGE_PATH.test(value)
const hasImage = (asset) => typeof asset?.dataUrl === 'string' && asset.dataUrl.startsWith('data:image/')

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

export const needsUpload = (asset) => hasImage(asset) && !isStoragePath(asset.storagePath) && imageBytes(asset.dataUrl) <= MEDIA_MAX_BYTES
export const needsHydration = (asset) => isStoragePath(asset?.storagePath) && !hasImage(asset)

// สำเนาสำหรับบันทึก: รูปที่อยู่ในที่เก็บไฟล์แล้วไม่ต้องพก dataUrl · ไม่แก้ object เดิม · รูปที่ยังไม่ได้ย้ายคงเดิม
export function dehydrateWorkspace(workspace) {
  if (!workspace || !Array.isArray(workspace.mediaAssets)) return workspace
  if (!workspace.mediaAssets.some((asset) => isStoragePath(asset?.storagePath) && asset.dataUrl !== undefined)) return workspace
  return {
    ...workspace,
    mediaAssets: workspace.mediaAssets.map((asset) => {
      if (!isStoragePath(asset?.storagePath)) return asset
      const { dataUrl, ...rest } = asset
      return rest
    }),
  }
}

// ใส่รูปที่ดึงกลับมาลงในเวิร์กสเปซ (เฉพาะรูปที่ยังไม่มี dataUrl และตำแหน่งไฟล์ยังตรง) · ไม่มีอะไรเปลี่ยน = คืน object เดิม
export function hydrateWorkspace(workspace, loaded = {}) {
  if (!workspace || !Array.isArray(workspace.mediaAssets)) return workspace
  let changed = false
  const mediaAssets = workspace.mediaAssets.map((asset) => {
    const hit = loaded[asset?.id]
    if (!hit || hasImage(asset) || asset.storagePath !== hit.storagePath || !String(hit.dataUrl || '').startsWith('data:image/')) return asset
    changed = true
    return { ...asset, dataUrl: hit.dataUrl }
  })
  return changed ? { ...workspace, mediaAssets } : workspace
}

// บันทึกตำแหน่งไฟล์ของรูปที่อัปโหลดและตรวจแล้ว (เฉพาะเมื่อรูปยังเป็นรูปเดิม — ระหว่างรออาจถูกแทนด้วยรูปใหม่)
export function markStored(workspace, assetId, storagePath, originalDataUrl) {
  if (!workspace || !Array.isArray(workspace.mediaAssets) || !isStoragePath(storagePath)) return workspace
  let changed = false
  const mediaAssets = workspace.mediaAssets.map((asset) => {
    if (asset?.id !== assetId || isStoragePath(asset.storagePath) || !sameImage(asset.dataUrl, originalDataUrl)) return asset
    changed = true
    return { ...asset, storagePath }
  })
  return changed ? { ...workspace, mediaAssets } : workspace
}

// สรุปสถานะรูปสำหรับแถบสถานะ: ย้ายแล้ว · รอย้าย · รอโหลด · ใหญ่เกินจึงอยู่ในก้อน
export function mediaSummary(workspace) {
  const assets = Array.isArray(workspace?.mediaAssets) ? workspace.mediaAssets : []
  return {
    total: assets.length,
    stored: assets.filter((asset) => isStoragePath(asset?.storagePath)).length,
    pendingUpload: assets.filter(needsUpload).length,
    pendingLoad: assets.filter(needsHydration).length,
    tooLarge: assets.filter((asset) => hasImage(asset) && !isStoragePath(asset.storagePath) && imageBytes(asset.dataUrl) > MEDIA_MAX_BYTES).length,
  }
}
