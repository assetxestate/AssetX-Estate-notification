import React, { useEffect, useRef, useState } from 'react'
import { ARTWORK_FORMATS, ARTWORK_THEMES, defaultArtwork, readArtworkImage, renderArtwork } from './lib/marketingArtwork.js'
import './ArtworkEditor.css'

export default function ArtworkEditor({ brief, asset, onSave, onClose }) {
  const [design, setDesign] = useState(() => ({ ...defaultArtwork(brief), ...(asset ? { sourceKind: 'upload' } : {}), ...asset?.design }))
  const [source, setSource] = useState(asset?.sourceDataUrl || asset?.dataUrl || '')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [renderError, setRenderError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rendering, setRendering] = useState(false)
  const dialog = useRef(null)
  const controller = useRef(null)
  const upload = useRef(null)
  const original = design.layout === 'original'
  const patch = (value) => setDesign((current) => ({ ...current, ...value }))

  useEffect(() => {
    dialog.current.showModal()
    return () => { controller.current?.abort() }
  }, [])

  useEffect(() => {
    let cancelled = false
    setPreview(null)
    setRenderError('')
    if (!source) return undefined
    setRendering(true)
    const timer = setTimeout(() => {
      renderArtwork(source, design).then((result) => {
        if (!cancelled) setPreview(result)
      }).catch((err) => {
        if (!cancelled) setRenderError(err.message)
      }).finally(() => { if (!cancelled) setRendering(false) })
    }, 180)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [source, design])

  const generate = async () => {
    if (!design.prompt.trim() || busy) return
    setBusy(true)
    setError('')
    controller.current = new AbortController()
    try {
      const response = await fetch('/api/marketing-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.current.signal,
        body: JSON.stringify({
          prompt: design.prompt,
          mode: 'artwork-background',
          aspectRatio: '1:1',
          styleProfile: {
            name: design.style === 'photo' ? 'Real estate editorial photography' : 'Architectural miniature',
            prompt: design.style === 'photo'
              ? 'Natural daylight, realistic Thai architecture and landscape, clear property details, balanced wide composition.'
              : 'Tactile architectural scale model of Thai property, white studio background, clean miniature composition.',
          },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.dataUrl) throw new Error(response.status === 401
        ? 'กรุณาเข้าสู่ระบบใหม่ หรือตรวจการตั้งค่าบริการสร้างภาพ' : data.error || 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง')
      await useSource(data.dataUrl, 'ai')
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally { setBusy(false) }
  }

  const useSource = async (url, kind) => {
    const image = await readArtworkImage(url)
    const ratio = Math.min(1, 1400 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * ratio)
    canvas.height = Math.round(image.height * ratio)
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    setSource(canvas.toDataURL('image/jpeg', 0.86))
    patch({ sourceKind: kind, cropX: 50, cropY: 50, zoom: 1 })
  }

  const uploadSource = async (file) => {
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setError('เลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 12 MB')
      return
    }
    const url = URL.createObjectURL(file)
    setBusy(true)
    try { await useSource(url, 'upload') }
    catch (err) { setError(err.message) }
    finally { URL.revokeObjectURL(url); setBusy(false) }
  }

  const attach = async () => {
    if (!preview || (!original && !design.headline.trim())) return
    setBusy(true)
    setError('')
    try { await onSave({ ...preview, design, sourceDataUrl: source }); onClose() }
    catch (err) { setError(err.message || 'บันทึกภาพไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  return <dialog ref={dialog} className="ax-artwork" aria-labelledby="artwork-title" onCancel={(event) => {
    event.preventDefault()
    if (!busy) onClose()
  }}>
    <header><div><h2 id="artwork-title">ออกแบบภาพโพสต์</h2><span>{brief.title || brief.headline}</span></div>
      <button type="button" onClick={onClose} disabled={busy}>ปิด</button></header>
    <div className="ax-artwork-body">
      <div className="ax-artwork-fields">
        <fieldset disabled={busy}>
          <legend>ภาพประกอบ</legend>
          <label>รายละเอียดภาพ<textarea value={design.prompt} maxLength={1600} onChange={(e) => patch({ prompt: e.target.value })} /></label>
          <label>สไตล์<select value={design.style} onChange={(e) => patch({ style: e.target.value })}>
            <option value="photo">ภาพถ่ายธรรมชาติ</option><option value="miniature">โมเดลสถาปัตยกรรม</option>
          </select></label>
          <div className="ax-artwork-actions">
            <button type="button" className="accent" disabled={!design.prompt.trim()} onClick={generate}>{busy ? 'กำลังเตรียมภาพ...' : source ? 'สร้างภาพ AI ใหม่' : 'สร้างภาพ AI'}</button>
            <button type="button" onClick={() => upload.current.click()}>อัปโหลดภาพ</button>
            <input ref={upload} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { uploadSource(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        </fieldset>
        <label>รูปแบบภาพ<select value={design.layout} disabled={busy} onChange={(e) => patch({ layout: e.target.value })}>
          <option value="original">โปสเตอร์สำเร็จรูป · เต็มภาพ</option>
          <option value="editorial">หัวข้อด้านบน</option><option value="photo">ภาพด้านบน</option>
        </select></label>
        {!original && <fieldset disabled={busy}>
          <legend>ข้อความบนภาพ</legend>
          <label>หัวข้อ<textarea value={design.headline} maxLength={120} onChange={(e) => patch({ headline: e.target.value })} /></label>
          <label>รายละเอียดสั้น<input value={design.subtitle} maxLength={95} onChange={(e) => patch({ subtitle: e.target.value })} /></label>
          <label>ข้อความติดต่อ<input value={design.cta} maxLength={48} onChange={(e) => patch({ cta: e.target.value })} /></label>
        </fieldset>}
        {!original && <fieldset disabled={busy}>
          <legend>การจัดวาง</legend>
          <label>ขนาด<select value={design.format} onChange={(e) => patch({ format: e.target.value })}>
            {Object.entries(ARTWORK_FORMATS).map(([id, item]) => <option key={id} value={id}>{item.label} · {item.width} × {item.height}</option>)}
          </select></label>
          <div className="ax-artwork-swatches" role="group" aria-label="ชุดสี">
            {Object.entries(ARTWORK_THEMES).map(([id, item]) => <button type="button" key={id} title={item.label} aria-label={item.label} aria-pressed={design.theme === id} style={{ background: item.accent }} onClick={() => patch({ theme: id })} />)}
          </div>
          <label>ขยายภาพ<input type="range" min="1" max="2" step="0.05" value={design.zoom} onChange={(e) => patch({ zoom: Number(e.target.value) })} /></label>
          <label>ตำแหน่งแนวนอน<input type="range" min="0" max="100" value={design.cropX} onChange={(e) => patch({ cropX: Number(e.target.value) })} /></label>
          <label>ตำแหน่งแนวตั้ง<input type="range" min="0" max="100" value={design.cropY} onChange={(e) => patch({ cropY: Number(e.target.value) })} /></label>
        </fieldset>}
      </div>
      <div className="ax-artwork-preview">
        <div className="ax-artwork-sheet" style={{ aspectRatio: original && preview ? `${preview.width} / ${preview.height}` : design.format === 'square' ? '1 / 1' : '4 / 5' }} aria-busy={busy || rendering}>
          {preview ? <img src={preview.dataUrl} alt={design.headline} /> : <div className="ax-artwork-empty"><img src="/logo.jpg" alt="AssetX Estate" /><p>{busy ? 'กำลังสร้างภาพ...' : rendering ? 'กำลังจัดวาง...' : 'ยังไม่มีภาพ'}</p></div>}
        </div>
        {preview && <a href={preview.dataUrl} download="assetx-artwork.jpg">ดาวน์โหลด JPG</a>}
        {(error || renderError) && <p className="ax-artwork-error" role="alert">{error || renderError}</p>}
      </div>
    </div>
    <footer><span>{preview?.width || ARTWORK_FORMATS[design.format].width} × {preview?.height || ARTWORK_FORMATS[design.format].height} px</span>
      <button type="button" className="accent" disabled={busy || rendering || !preview || (!original && !design.headline.trim())} onClick={attach}>บันทึกและแนบกับโพสต์</button></footer>
  </dialog>
}
