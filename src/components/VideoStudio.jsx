// หน้าทำวิดีโอของ /marketing (เจ้าของขอแยกจากการ์ดร่าง 23 พ.ย. 2569) — หน้าเต็มสำหรับคอนเทนต์หนึ่งชิ้น
// ข้อมูลยังเป็นของคอนเทนต์ชิ้นเดิมในหน้า /marketing: ชุดคอนเทนต์เก็บที่ post.contentPack ของโพสต์นั้น (ไม่มีที่เก็บแยก)
//   → แก้ข้อความโพสต์ที่แท็บ ร่าง แล้วหน้านี้ขึ้นป้ายล้าสมัย · สร้างใหม่จากข้อความล่าสุดได้ที่นี่
// ทำอะไรได้: สร้าง/สร้างใหม่ storyboard · แก้ภาพ บทพูด ตัวหนังสือบนจอรายฉาก · ติ๊กฉากที่ถ่ายแล้วและของที่เตรียมแล้ว · บทพูดล้วน · Carousel · บรีฟภาพ
// ตรรกะล้วนอยู่ใน src/lib/marketingContentPack.js — หน้านี้ไม่สร้างวิดีโอเอง เป็นโต๊ะวางแผนและเช็กงานถ่าย
import React, { useEffect, useState } from 'react'
import ClipPanel from './ClipPanel.jsx'
import { REEL_DEFAULT_SEC, REEL_MAX_SEC, REEL_MIN_SEC, buildContentPack, isPackStale, narrationScript, packProgress, storyboardText, teleprompterText, togglePrep, updateScene } from '../lib/marketingContentPack.js'

const ROLE = { hook: 'เปิด', explain: 'เนื้อหา', point: 'ข้อ', caveat: 'ข้อจำกัด', cta: 'ชวนทำ' }
const SLIDE = { cover: 'ปก', content: 'เนื้อหา', caveat: 'ข้อจำกัด', cta: 'ชวนทำ' }
const STATUS = { draft: 'รอตรวจ', pending: 'รอตรวจ', needs_edit: 'รอตรวจ', approved: 'อนุมัติแล้ว', scheduled: 'ตั้งเวลาแล้ว', posted: 'โพสต์แล้ว', archived: 'พักไว้' }

export default function VideoStudio({ posts = [], post = null, claims = [], loading = false, onSelect, onSavePack, onSaveClip, onOpenPost, onCopy, onBack }) {
  const pack = post?.contentPack || null
  const [seconds, setSeconds] = useState(pack?.reel?.duration || REEL_DEFAULT_SEC)
  const [error, setError] = useState('')
  useEffect(() => { setSeconds(post?.contentPack?.reel?.duration || REEL_DEFAULT_SEC); setError('') }, [post?.id])

  const stale = post ? isPackStale(post) : false
  const progress = packProgress(pack)
  const prepDone = new Set(pack?.reel?.prepDone || [])
  const save = (next, message) => { if (next !== pack) onSavePack?.(post, next, message) }

  const build = () => {
    if ((progress.edited || progress.scenesDone || progress.prepDone) && !window.confirm('สร้างใหม่จะแทนที่ฉากที่แก้เอง และล้างเครื่องหมายที่ติ๊กไว้ทั้งหมด\n\nกด ตกลง เพื่อสร้างใหม่จากข้อความล่าสุดของโพสต์')) return
    const result = buildContentPack(post, { durationSec: seconds, claims })
    if (!result.ok) { setError(result.error); return }
    setError('')
    onSavePack?.(post, result.pack, pack ? 'สร้าง storyboard ใหม่จากข้อความล่าสุดแล้ว' : 'สร้าง storyboard แล้ว')
  }
  const carouselText = () => (pack?.carousel?.slides || []).map((slide) => `หน้า ${slide.no} (${SLIDE[slide.role]}): ${slide.title}${slide.body ? `\n${slide.body}` : ''}\nภาพ: ${slide.visual}${slide.source_note ? `\n${slide.source_note}` : ''}`).join('\n\n')

  return (
    <section className="mx-content bp-video">
      <div className="mx-page-head compact">
        <div>
          <div className="mx-kicker">ทำวิดีโอ</div>
          <h1>{post ? `${post.contentNo ? `#${post.contentNo} ` : ''}${post.title || 'ไม่มีพาดหัว'}` : 'เลือกคอนเทนต์ที่จะทำวิดีโอ'}</h1>
          <p>โต๊ะวางแผนและเช็กงานถ่ายของคอนเทนต์ชิ้นนี้ · ข้อมูลผูกกับโพสต์เดียวกันในแท็บ ร่าง และ โพสต์ · หน้านี้ไม่สร้างไฟล์วิดีโอเอง แนบคลิปที่ตัดต่อเสร็จแล้วส่งขึ้นเพจเป็น Reel ได้</p>
        </div>
        <div className="mx-page-actions"><button className="mx-secondary" type="button" onClick={onBack}>← กลับไปที่ร่าง</button></div>
      </div>

      <label className="bp-reviewer-row">คอนเทนต์
        <select value={post?.contentNo || ''} onChange={(event) => onSelect?.(Number(event.target.value))}>
          <option value="">เลือกคอนเทนต์</option>
          {posts.map((item) => <option key={item.id} value={item.contentNo}>#{item.contentNo} {String(item.title || '').slice(0, 60)} · {STATUS[item.status] || item.status}{item.contentPack ? ' · มี storyboard' : ''}</option>)}
        </select>
      </label>

      {!post && <div className="mx-empty">เลือกคอนเทนต์จากรายการด้านบน หรือกด เปิดหน้าทำวิดีโอ บนการ์ดในแท็บ ร่าง</div>}
      {post && (
        <div className="bp-video-layout">
          <aside className="bp-video-side">
            <div className="bp-series-card">
              <div className="bp-claim-head"><strong>ข้อความของโพสต์</strong><span className="bp-tag">{STATUS[post.status] || post.status}</span></div>
              <p className="bp-ai-caption">{post.caption}</p>
              <p className="bp-note">ข้อความนี้คือฉบับที่ผ่านการตรวจและอนุมัติ · แก้ที่การ์ดของโพสต์ แล้วกลับมาสร้าง storyboard ใหม่</p>
              <div className="bp-actions"><button type="button" className="mx-mini-button" onClick={() => onOpenPost?.(post)}>ไปที่การ์ดของโพสต์นี้</button></div>
            </div>
          </aside>
          <div className="bp-video-main">
            <ClipPanel post={post} posts={posts} loading={loading} onSaveClip={onSaveClip} />
            <div className="bp-actions">
              <label className="bp-inline">ความยาว Reel (วินาที)
                <input type="number" inputMode="numeric" min={REEL_MIN_SEC} max={REEL_MAX_SEC} value={seconds} disabled={loading} onChange={(event) => setSeconds(event.target.value)} />
              </label>
              <button type="button" className="mx-primary" disabled={loading} onClick={build}>{pack ? 'สร้างใหม่จากข้อความล่าสุด' : 'สร้าง storyboard'}</button>
              {pack && <span className="bp-note">ถ่ายแล้ว {progress.scenesDone}/{progress.scenes} ฉาก · เตรียมของแล้ว {progress.prepDone}/{progress.prep}{progress.edited ? ` · แก้เอง ${progress.edited} ฉาก` : ''}</span>}
            </div>
            {error && <p className="bp-error" role="alert">{error}</p>}
            {!pack && <p className="bp-note">ระบบแบ่งข้อความของโพสต์เป็นฉาก: เปิด เนื้อหา ข้อจำกัด และชวนทำ พร้อมเวลา ภาพที่ต้องถ่าย บทพูด และตัวหนังสือบนจอ · ไม่ใช้ AI และไม่เติมข้อเท็จจริง</p>}
            {pack && stale && <p className="bp-ai-status warn" role="status">ข้อความของโพสต์เปลี่ยนหลังสร้างชุดนี้ — กด สร้างใหม่จากข้อความล่าสุด ก่อนนำไปถ่าย</p>}
            {pack && (
              <>
                {pack.reel.warnings.map((item) => <p className="bp-pack-warn" key={item}>{item}</p>)}
                <h2 className="mx-section-title">ฉากของ Reel · {pack.reel.duration} วินาที</h2>
                <p className="bp-note">แก้ภาพ บทพูด และตัวหนังสือบนจอได้ทีละฉาก · บทพูดที่แก้เองไม่ผ่านด่านตรวจของโพสต์ ให้ตรงกับข้อความที่อนุมัติ และห้ามเติมตัวเลขหรือเคสที่ไม่มีในโพสต์</p>
                <div className="bp-video-scenes">
                  {pack.reel.scenes.map((scene) => (
                    <article className={`bp-video-scene ${scene.done ? 'done' : ''}`} key={scene.no}>
                      <div className="bp-claim-head">
                        <strong>ฉาก {scene.no} · {scene.start_sec}–{scene.end_sec} วิ · {ROLE[scene.role]}</strong>
                        <label className="bp-check"><input type="checkbox" checked={Boolean(scene.done)} disabled={loading} onChange={(event) => save(updateScene(pack, scene.no, { done: event.target.checked }))} />ถ่ายแล้ว</label>
                      </div>
                      <label>ภาพ
                        <textarea rows={2} defaultValue={scene.shot} key={`s-${pack.builtAt}-${scene.no}`} disabled={loading} onBlur={(event) => save(updateScene(pack, scene.no, { shot: event.target.value }))} />
                      </label>
                      <label>บทพูด
                        <textarea rows={2} defaultValue={scene.narration} key={`n-${pack.builtAt}-${scene.no}`} disabled={loading} onBlur={(event) => save(updateScene(pack, scene.no, { narration: event.target.value }))} />
                      </label>
                      <label>ตัวหนังสือบนจอ
                        <input defaultValue={scene.overlay} key={`o-${pack.builtAt}-${scene.no}`} maxLength={60} disabled={loading} onBlur={(event) => save(updateScene(pack, scene.no, { overlay: event.target.value }))} />
                      </label>
                      <label>โน้ตของคนถ่าย
                        <input defaultValue={scene.note || ''} key={`t-${pack.builtAt}-${scene.no}`} maxLength={200} disabled={loading} placeholder="เช่น ถ่ายช่วงเช้า มุมจากฝั่งถนน" onBlur={(event) => save(updateScene(pack, scene.no, { note: event.target.value }))} />
                      </label>
                      {(scene.edited || scene.proof_source_ids.length > 0) && <span className="bp-note">{scene.edited ? 'แก้เองแล้ว' : ''}{scene.edited && scene.proof_source_ids.length ? ' · ' : ''}{scene.proof_source_ids.length ? `ใช้ข้ออ้าง ${scene.proof_source_ids.join(', ')}` : ''}</span>}
                    </article>
                  ))}
                </div>
                <div className="bp-actions">
                  <button type="button" className="mx-secondary" onClick={() => onCopy?.(storyboardText(pack.reel))}>คัดลอก storyboard</button>
                  <button type="button" className="mx-secondary" onClick={() => onCopy?.(teleprompterText(pack.reel))}>คัดลอกบทพูดล้วน</button>
                </div>

                <h2 className="mx-section-title">สร้างคลิปด้วย AI จากบทพูดนี้</h2>
                {(() => {
                  const hero = narrationScript(pack.reel)
                  return (
                    <div className="bp-gate-section">
                      <span>เครื่องมือทำคลิปจากบทพูด (HERO AI) ใส่เสียงพากย์ ภาพประกอบ และซับไทยให้เอง · ตอนนี้ยังสั่งสร้างจากหน้านี้โดยตรงไม่ได้ จึงเตรียมสคริปต์ให้คัดลอกไปวางใน HERO AI Studio</span>
                      {hero.needsRealFootage && <span className="bp-pack-warn">โพสต์นี้มีฉากที่ต้องใช้ภาพหน้างานจริง — ภาพประกอบของเครื่องมือ AI เป็นภาพสต็อกหรือภาพที่สร้างขึ้น ห้ามใช้แทนสถานที่จริง ถ้าจะใช้ AI ทำคลิป ให้ใส่ภาพหน้างานของเราเองแทนในฉากนั้น</span>}
                      <span><b>พาดหัวเปิดคลิป</b> {hero.headlineHook}</span>
                      <span className="bp-ai-caption">{hero.script}</span>
                      <div className="bp-actions">
                        <button type="button" className="mx-secondary" onClick={() => onCopy?.(hero.script)}>คัดลอกสคริปต์สำหรับ HERO AI</button>
                        <button type="button" className="mx-mini-button" onClick={() => onCopy?.(hero.headlineHook)}>คัดลอกพาดหัวเปิดคลิป</button>
                        <a className="mx-mini-button" href="https://studio.heroaiengine.com" target="_blank" rel="noreferrer noopener">เปิด HERO AI Studio</a>
                      </div>
                    </div>
                  )
                })()}

                <h2 className="mx-section-title">ของที่ต้องเตรียมก่อนถ่าย</h2>
                {[['ภาพที่ต้องถ่ายหรือหา', pack.reel.prep.footage], ['กราฟิกที่ต้องทำ', pack.reel.prep.graphics]].map(([label, items]) => (
                  <div className="bp-gate-section" key={label}>
                    <em>{label}</em>
                    {items.length === 0 && <span>ไม่มี</span>}
                    {items.map((item) => (
                      <label className="bp-check" key={item}><input type="checkbox" checked={prepDone.has(item)} disabled={loading} onChange={() => save(togglePrep(pack, item))} />{item}</label>
                    ))}
                  </div>
                ))}

                <h2 className="mx-section-title">Carousel · {pack.carousel.slides.length} หน้า</h2>
                <div className="bp-gate-section">
                  {pack.carousel.slides.map((slide) => <span key={slide.no}><b>หน้า {slide.no} · {SLIDE[slide.role]}</b> {slide.title}{slide.body ? ` — ${slide.body}` : ''}{slide.source_note ? ` · ${slide.source_note}` : ''}</span>)}
                  {pack.carousel.warnings.map((item) => <span className="bp-pack-warn" key={item}>{item}</span>)}
                  <div className="bp-actions"><button type="button" className="mx-mini-button" onClick={() => onCopy?.(carouselText())}>คัดลอก Carousel</button></div>
                </div>

                <h2 className="mx-section-title">บรีฟภาพจากโพสต์นี้</h2>
                <div className="bp-gate-section">
                  <span>{pack.imagePrompt}</span>
                  <div className="bp-actions"><button type="button" className="mx-mini-button" onClick={() => onCopy?.(pack.imagePrompt)}>คัดลอกบรีฟภาพ</button></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
