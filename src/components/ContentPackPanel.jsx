// ชุดคอนเทนต์บนการ์ดร่างของ /marketing: storyboard ของ Reel + Carousel + บรีฟภาพ จากข้อความของร่างนั้น — เฟส P2 · 23 พ.ย. 2569
// ตรรกะล้วนอยู่ใน src/lib/marketingContentPack.js (ไม่ใช้ AI ไม่เติมข้อเท็จจริง) · ชุดเก็บไว้กับร่าง (post.contentPack)
// แก้พาดหัวหรือแคปชั่นแล้วชุดเดิมขึ้นป้ายล้าสมัย ต้องสร้างใหม่ก่อนนำไปใช้
import React, { useState } from 'react'
import { REEL_DEFAULT_SEC, REEL_MAX_SEC, REEL_MIN_SEC, buildContentPack, isPackStale, storyboardText } from '../lib/marketingContentPack.js'

const ROLE = { hook: 'เปิด', explain: 'เนื้อหา', point: 'ข้อ', caveat: 'ข้อจำกัด', cta: 'ชวนทำ' }
const SLIDE = { cover: 'ปก', content: 'เนื้อหา', caveat: 'ข้อจำกัด', cta: 'ชวนทำ' }

export default function ContentPackPanel({ post, claims = [], disabled = false, onSave, onCopy }) {
  const [seconds, setSeconds] = useState(post.contentPack?.reel?.duration || REEL_DEFAULT_SEC)
  const [error, setError] = useState('')
  const pack = post.contentPack || null
  const stale = isPackStale(post)

  const build = () => {
    const result = buildContentPack(post, { durationSec: seconds, claims })
    if (!result.ok) { setError(result.error); return }
    setError('')
    onSave?.(result.pack)
  }
  const carouselText = () => (pack?.carousel?.slides || []).map((slide) => `หน้า ${slide.no} (${SLIDE[slide.role]}): ${slide.title}${slide.body ? `\n${slide.body}` : ''}\nภาพ: ${slide.visual}${slide.source_note ? `\n${slide.source_note}` : ''}`).join('\n\n')

  return (
    <details className="bp-pack" onClick={(event) => event.stopPropagation()}>
      <summary>
        <span>ชุดคอนเทนต์: Reel · Carousel · บรีฟภาพ</span>
        <small>{!pack ? 'ยังไม่ได้สร้าง' : stale ? 'ล้าสมัย: ข้อความของร่างเปลี่ยนแล้ว' : `สร้างแล้ว · Reel ${pack.reel.duration} วินาที ${pack.reel.scenes.length} ฉาก · Carousel ${pack.carousel.slides.length} หน้า`}</small>
      </summary>
      <div className="bp-actions">
        <label className="bp-inline">ความยาว Reel (วินาที)
          <input type="number" inputMode="numeric" min={REEL_MIN_SEC} max={REEL_MAX_SEC} value={seconds} disabled={disabled} onChange={(event) => setSeconds(event.target.value)} />
        </label>
        <button type="button" className="mx-secondary" disabled={disabled} onClick={build}>{pack ? 'สร้างใหม่จากข้อความล่าสุด' : 'สร้างชุดคอนเทนต์'}</button>
      </div>
      <span className="bp-note">สร้างจากข้อความของร่างนี้เท่านั้น ระบบไม่เติมข้อเท็จจริง · ภาพหน้างานต้องเป็นภาพจริงที่มีสิทธิใช้ ห้ามใช้ภาพ AI แทนสถานที่จริงหรือเอกสารสิทธิ์</span>
      {error && <p className="bp-error" role="alert">{error}</p>}
      {pack && stale && <p className="bp-ai-status warn" role="status">ข้อความของร่างเปลี่ยนหลังสร้างชุดนี้ — กด สร้างใหม่จากข้อความล่าสุด ก่อนนำไปถ่ายหรือออกแบบ</p>}
      {pack && (
        <>
          <div className="bp-gate-section">
            <em>Storyboard ของ Reel · {pack.reel.duration} วินาที</em>
            <div className="bp-pack-scenes" role="table" aria-label="ฉากของ Reel">
              {pack.reel.scenes.map((scene) => (
                <div className="bp-pack-scene" role="row" key={scene.no}>
                  <b role="cell">{scene.start_sec}–{scene.end_sec} วิ · {ROLE[scene.role]}</b>
                  <span role="cell"><i>ภาพ</i> {scene.shot}</span>
                  <span role="cell"><i>พูด</i> {scene.narration}</span>
                  <span role="cell"><i>บนจอ</i> {scene.overlay}{scene.proof_source_ids.length ? ` · ใช้ข้ออ้าง ${scene.proof_source_ids.join(', ')}` : ''}</span>
                </div>
              ))}
            </div>
            {pack.reel.prep.footage.length > 0 && <span>ภาพที่ต้องถ่ายหรือหา: {pack.reel.prep.footage.join(' · ')}</span>}
            {pack.reel.prep.graphics.length > 0 && <span>กราฟิกที่ต้องทำ: {pack.reel.prep.graphics.join(' · ')}</span>}
            {pack.reel.warnings.map((item) => <span className="bp-pack-warn" key={item}>{item}</span>)}
            <div className="bp-actions"><button type="button" className="mx-mini-button" onClick={() => onCopy?.(storyboardText(pack.reel))}>คัดลอก storyboard</button></div>
          </div>
          <div className="bp-gate-section">
            <em>Carousel · {pack.carousel.slides.length} หน้า</em>
            {pack.carousel.slides.map((slide) => (
              <span key={slide.no}><b>หน้า {slide.no} · {SLIDE[slide.role]}</b> {slide.title}{slide.body ? ` — ${slide.body}` : ''}{slide.source_note ? ` · ${slide.source_note}` : ''}</span>
            ))}
            {pack.carousel.warnings.map((item) => <span className="bp-pack-warn" key={item}>{item}</span>)}
            <div className="bp-actions"><button type="button" className="mx-mini-button" onClick={() => onCopy?.(carouselText())}>คัดลอก Carousel</button></div>
          </div>
          <div className="bp-gate-section">
            <em>บรีฟภาพจากร่างนี้ (ภาษาอังกฤษ สำหรับโปรแกรมสร้างภาพ)</em>
            <span>{pack.imagePrompt}</span>
            <div className="bp-actions"><button type="button" className="mx-mini-button" onClick={() => onCopy?.(pack.imagePrompt)}>คัดลอกบรีฟภาพ</button></div>
          </div>
        </>
      )}
    </details>
  )
}
