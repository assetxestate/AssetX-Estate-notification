import React, { useEffect, useRef, useState } from 'react'
import { ARTWORK_FORMATS, ARTWORK_THEMES, defaultArtwork, readArtworkImage, renderArtwork } from './lib/marketingArtwork.js'
import { errorMessage, friendlyApiError } from './lib/marketingErrors.js'
import { POSTER_SIZES, defaultPosterSizeFor } from './lib/posterSizes.js'
import { chatJobMessage, isActiveJob, postKeyFor } from './lib/chatgptImageJob.js'
import './ArtworkEditor.css'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const POLL_MS = 4000

export default function ArtworkEditor({ brief, asset, onSave, onClose }) {
  // posterSize = ขนาดครอปของโปสเตอร์สำเร็จรูป · '' = ตามภาพต้นฉบับ (ค่าเดิมของภาพอัปโหลดและภาพที่แนบไว้ก่อนมีเมนูนี้)
  const [design, setDesign] = useState(() => ({ ...defaultArtwork(brief), posterSize: '', ...(asset ? { sourceKind: 'upload' } : {}), ...asset?.design }))
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

  // ---- โปสเตอร์จาก ChatGPT: ส่งงานเข้าคิว → คอมสำนักงาน (scripts/image-worker.mjs) สร้างภาพ → ถามสถานะทุก 4 วินาทีจนได้ภาพ
  const postKey = postKeyFor(brief)
  const [chat, setChat] = useState({ job: null, worker: null })
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [appliedJobId, setAppliedJobId] = useState(null)
  const [, setTick] = useState(0)
  // ขนาดที่จะสั่ง ChatGPT (เลือกก่อนกดสร้าง) แยกจาก posterSize ของภาพที่แสดงอยู่ ไม่ให้ภาพอัปโหลดถูกครอปตามไปด้วย
  const [chatSize, setChatSize] = useState(() => (POSTER_SIZES[asset?.design?.posterSize] ? asset.design.posterSize : defaultPosterSizeFor(brief.channel)))
  // รูปแบบการออกแบบ: ref = ตามเรฟ (โครงการ์ดแน่น หมุนชุดสไตล์) · free = ให้ Codex ออกแบบเองจากหัวข้อ ข้อความ และมู้ดแอนด์โทนของแบรนด์ (ทดลอง)
  const [chatMode, setChatMode] = useState('ref')
  const chatActive = isActiveJob(chat.job)
  const activeJobId = chatActive ? chat.job.id : null
  const chatDoneUnused = chat.job?.status === 'done' && appliedJobId !== chat.job.id
  const chatMessage = chatDoneUnused
    ? 'มีโปสเตอร์ที่สร้างเสร็จแล้วของโพสต์นี้ กด "ใช้ภาพที่สร้างเสร็จ" เพื่อเปิดดู'
    : chatJobMessage(chat.job, chat.worker)

  const jobsApi = async (query = '', options = undefined) => {
    const response = await fetch(`/api/marketing-image-jobs${query}`, options)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(friendlyApiError(response.status, data, 'ติดต่อคิวสร้างภาพไม่สำเร็จ กรุณาลองใหม่'))
    return data
  }

  const applyChatImage = async (job, image) => {
    await useSource(image, 'ai')
    patch({ layout: 'original', posterSize: POSTER_SIZES[job.size] ? job.size : '' })
    setAppliedJobId(job.id)
  }

  // เปิดหน้าต่าง = ดูงานล่าสุดของโพสต์นี้ (ปิดหน้าต่างระหว่างรอได้ งานบนคอมยังเดินต่อ เปิดใหม่แล้วตามต่อ)
  useEffect(() => {
    if (!postKey) return undefined
    let cancelled = false
    const lookup = async () => {
      try {
        const data = await jobsApi(`?post_key=${encodeURIComponent(postKey)}`)
        if (!cancelled) setChat({ job: data.job || null, worker: data.worker || null })
      } catch { /* ยังไม่ติดตั้งคิว/ออฟไลน์ = ไม่โชว์สถานะ ปุ่มยังกดได้และจะบอกเหตุผลตอนกด */ }
    }
    lookup()
    return () => { cancelled = true }
  }, [postKey])

  useEffect(() => {
    if (!activeJobId) return undefined
    let stopped = false
    let timer = null
    const ticker = setInterval(() => setTick((value) => value + 1), 1000)
    const poll = async () => {
      try {
        const data = await jobsApi(`?id=${activeJobId}&image=1`)
        if (stopped) return
        setChatError('')
        setChat({ job: data.job, worker: data.worker })
        if (data.job?.status === 'done' && data.image) await applyChatImage(data.job, data.image)
      } catch (err) {
        if (!stopped) setChatError(errorMessage(err, 'ถามสถานะงานสร้างภาพไม่สำเร็จ จะลองใหม่อัตโนมัติ'))
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS)
    }
    timer = setTimeout(poll, POLL_MS)
    return () => { stopped = true; clearTimeout(timer); clearInterval(ticker) }
  }, [activeJobId])

  const startChatJob = async () => {
    if (!postKey || chatActive || chatSending) return
    setChatSending(true)
    setChatError('')
    try {
      const data = await jobsApi('', {
        method: 'POST', headers: JSON_HEADERS,
        body: JSON.stringify({
          action: 'create',
          post_key: postKey,
          content_no: brief.contentNo,
          title: brief.title || brief.headline || design.headline,
          caption: brief.caption || design.prompt,
          size: chatSize,
          mode: chatMode,
        }),
      })
      setChat({ job: data.job, worker: data.worker })
    } catch (err) {
      setChatError(errorMessage(err, 'ส่งงานสร้างภาพไม่สำเร็จ กรุณาลองใหม่'))
    } finally { setChatSending(false) }
  }

  const cancelChatJob = async () => {
    if (chat.job?.status !== 'queued') return
    setChatError('')
    try {
      const data = await jobsApi('', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ action: 'cancel', id: chat.job.id }) })
      setChat((current) => ({ ...current, job: data.job }))
    } catch (err) { setChatError(errorMessage(err, 'ยกเลิกงานไม่สำเร็จ กรุณาลองใหม่')) }
  }

  const loadFinishedChatImage = async () => {
    if (chat.job?.status !== 'done') return
    setChatSending(true)
    setChatError('')
    try {
      const data = await jobsApi(`?id=${chat.job.id}&image=1`)
      if (!data.image) throw new Error('ไม่พบไฟล์ภาพของงานนี้ กดสร้างโปสเตอร์ใหม่ได้')
      await applyChatImage(data.job, data.image)
    } catch (err) {
      setChatError(errorMessage(err, 'โหลดภาพไม่สำเร็จ กรุณาลองใหม่'))
    } finally { setChatSending(false) }
  }

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
        if (!cancelled) setRenderError(errorMessage(err, 'แสดงตัวอย่างภาพไม่สำเร็จ ลองเลือกภาพใหม่'))
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
      if (!response.ok || !data.dataUrl) throw new Error(friendlyApiError(response.status, data, 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'))
      await useSource(data.dataUrl, 'ai')
    } catch (err) {
      if (err.name !== 'AbortError') setError(errorMessage(err, 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'))
    } finally { setBusy(false) }
  }

  const useSource = async (url, kind) => {
    const image = await readArtworkImage(url)
    // ภาพจาก AI เก็บเต็ม 1536 px (ภาพจาก ChatGPT สูง 1536) ไม่ให้ต้องขยายกลับตอนครอปเป็นขนาดแพลตฟอร์ม · ภาพอัปโหลดคง 1400 px เท่าเดิม
    const limit = kind === 'ai' ? 1536 : 1400
    const ratio = Math.min(1, limit / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * ratio)
    canvas.height = Math.round(image.height * ratio)
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    setSource(canvas.toDataURL('image/jpeg', 0.86))
    // ภาพใหม่เริ่มที่ "ตามภาพต้นฉบับ" เสมอ — ภาพจาก ChatGPT ตั้งขนาดครอปตามงานเองหลังบรรทัดนี้ (applyChatImage)
    patch({ sourceKind: kind, cropX: 50, cropY: 50, zoom: 1, posterSize: '', posterFit: 'contain' })
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
    catch (err) { setError(errorMessage(err, 'อ่านไฟล์รูปไม่สำเร็จ กรุณาเลือกภาพใหม่')) }
    finally { URL.revokeObjectURL(url); setBusy(false) }
  }

  const attach = async () => {
    if (!preview || (!original && !design.headline.trim())) return
    setBusy(true)
    setError('')
    try { await onSave({ ...preview, design, sourceDataUrl: source }); onClose() }
    catch (err) { setError(errorMessage(err, 'บันทึกภาพไม่สำเร็จ ลองใหม่อีกครั้ง')) }
    finally { setBusy(false) }
  }

  return <dialog ref={dialog} className="ax-artwork" aria-labelledby="artwork-title" onCancel={(event) => {
    event.preventDefault()
    if (!busy) onClose()
  }}>
    <header><div><h2 id="artwork-title">ออกแบบภาพโพสต์</h2><span>{brief.contentNo ? `#${brief.contentNo} · ` : ''}{brief.title || brief.headline}</span></div>
      <button type="button" onClick={onClose} disabled={busy}>ปิด</button></header>
    <div className="ax-artwork-body">
      <div className="ax-artwork-fields">
        <fieldset disabled={busy}>
          <legend>โปสเตอร์จาก ChatGPT</legend>
          <p className="ax-artwork-note">อ่านหัวข้อและเนื้อหาโพสต์ แล้วสร้างโปสเตอร์พร้อมข้อความไทยบนคอมสำนักงาน (ChatGPT Plus)</p>
          <label>ขนาดภาพตามแพลตฟอร์ม<select value={chatSize} disabled={chatActive} onChange={(e) => setChatSize(e.target.value)}>
            {Object.entries(POSTER_SIZES).map(([id, item]) => <option key={id} value={id}>{item.label} · {item.width} × {item.height}</option>)}
          </select></label>
          <label>รูปแบบการออกแบบ<select value={chatMode} disabled={chatActive} onChange={(e) => setChatMode(e.target.value)}>
            <option value="ref">ตามเรฟ · โครงการ์ดแน่น</option>
            <option value="free">อิสระ · ให้ Codex ออกแบบเอง (ทดลอง)</option>
          </select></label>
          {chatMode === 'free' && <p className="ax-artwork-note">ส่งหัวข้อ ข้อความจากโพสต์ และมู้ดแอนด์โทนของแบรนด์ให้ Codex คิดคอนเซปต์และจัดวางเอง ภาพแต่ละครั้งต่างกันมาก · ข้อความไทยยังคัดจากโพสต์คำต่อคำ แต่ตรวจตัวสะกดทุกครั้ง</p>}
          <div className="ax-artwork-actions">
            <button type="button" className="accent" disabled={!postKey || chatActive || chatSending} onClick={startChatJob}>
              {chatActive ? 'กำลังสร้างโปสเตอร์...' : chatSending ? 'กำลังส่งงาน...' : appliedJobId ? 'สร้างโปสเตอร์ใหม่' : 'สร้างโปสเตอร์ด้วย ChatGPT'}
            </button>
            {chat.job?.status === 'queued' && <button type="button" onClick={cancelChatJob}>ยกเลิกงาน</button>}
            {chatDoneUnused && <button type="button" disabled={chatSending} onClick={loadFinishedChatImage}>ใช้ภาพที่สร้างเสร็จ</button>}
          </div>
          {/* ไม่ใส่ role=status: ข้อความมีเวลาเดินทุกวินาที โปรแกรมอ่านหน้าจอจะอ่านซ้ำไม่หยุด */}
          {chatMessage && <p className="ax-artwork-note">{chatMessage}</p>}
          {chatError && <p className="ax-artwork-error" role="alert">{chatError}</p>}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>ภาพประกอบ</legend>
          <label>รายละเอียดภาพ<textarea value={design.prompt} maxLength={1600} onChange={(e) => patch({ prompt: e.target.value })} /></label>
          <label>สไตล์<select value={design.style} onChange={(e) => patch({ style: e.target.value })}>
            <option value="photo">ภาพถ่ายธรรมชาติ</option><option value="miniature">โมเดลสถาปัตยกรรม</option>
          </select></label>
          <div className="ax-artwork-actions">
            <button type="button" disabled={!design.prompt.trim()} onClick={generate}>{busy ? 'กำลังเตรียมภาพ...' : source ? 'ภาพพื้นหลัง AI ใหม่ (API)' : 'ภาพพื้นหลัง AI (API)'}</button>
            <button type="button" onClick={() => upload.current.click()}>อัปโหลดภาพ</button>
            <input ref={upload} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { uploadSource(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        </fieldset>
        <label>รูปแบบภาพ<select value={design.layout} disabled={busy} onChange={(e) => patch({ layout: e.target.value })}>
          <option value="original">โปสเตอร์สำเร็จรูป · เต็มภาพ</option>
          <option value="editorial">หัวข้อด้านบน</option><option value="photo">ภาพด้านบน</option>
        </select></label>
        {original && <fieldset disabled={busy}>
          <legend>ขนาดโปสเตอร์</legend>
          <label>ครอปเป็นขนาด<select value={POSTER_SIZES[design.posterSize] ? design.posterSize : ''} onChange={(e) => patch({ posterSize: e.target.value })}>
            <option value="">ตามภาพต้นฉบับ (ไม่ครอป)</option>
            {Object.entries(POSTER_SIZES).map(([id, item]) => <option key={id} value={id}>{item.label} · {item.width} × {item.height}</option>)}
          </select></label>
          {POSTER_SIZES[design.posterSize] && <label>วิธีปรับขนาด<select value={design.posterFit === 'cover' ? 'cover' : 'contain'} onChange={(e) => patch({ posterFit: e.target.value })}>
            <option value="contain">ย่อให้เห็นครบ · เติมขอบเบลอ</option>
            <option value="cover">ครอปเต็มกรอบ · ขอบภาพหาย</option>
          </select></label>}
          {POSTER_SIZES[design.posterSize] && design.posterFit === 'cover' && <>
            <label>ตำแหน่งแนวนอน<input type="range" min="0" max="100" value={design.cropX} onChange={(e) => patch({ cropX: Number(e.target.value) })} /></label>
            <label>ตำแหน่งแนวตั้ง<input type="range" min="0" max="100" value={design.cropY} onChange={(e) => patch({ cropY: Number(e.target.value) })} /></label>
          </>}
        </fieldset>}
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
        {renderError && <p className="ax-artwork-error" role="alert">{renderError}</p>}
      </div>
    </div>
    {/* ข้อผิดพลาดตอนสร้าง/บันทึกอยู่ข้างปุ่มบันทึกในแถบล่างที่ติดจอ (เดิมอยู่ใต้ภาพตัวอย่าง มองไม่เห็นบนจอ 768px และมือถือ) */}
    <footer><span>{preview?.width || ARTWORK_FORMATS[design.format].width} × {preview?.height || ARTWORK_FORMATS[design.format].height} px</span>
      {error && <p className="ax-artwork-error" role="alert">{error}</p>}
      <button type="button" className="accent" disabled={busy || rendering || !preview || (!original && !design.headline.trim())} onClick={attach}>บันทึกและแนบกับโพสต์</button></footer>
  </dialog>
}
