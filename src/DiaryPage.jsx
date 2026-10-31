// ไดอารี่งาน AssetX — หน้า /diary ในแอป (หลังล็อกอินของแอป ไม่ต้องมีบัญชี claude.ai)
// สมุดสองหน้า: สันซ้ายคือรายการวัน หน้าขวาคือบันทึกของวันที่เลือก · ด้านบนมีกล่อง "สั่งงาน Claude" และรายการค้างรวม
// ข้อมูลมาจาก /api/diary (ตาราง diary_days / diary_commands ผ่าน service role ฝั่งเซิร์ฟเวอร์)
// Claude อ่านคำสั่ง/ตัวเลือกจากตารางเดียวกันตอนเริ่ม session ด้วย scripts/diary-sync.mjs
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './DiaryPage.css'

const REPO = 'https://github.com/assetxestate/AssetX-Estate-notification'
const WD = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const MON_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const OWNER = { you: 'คุณ', decide: 'รอเลือก', claude: 'Claude' }
const ST = { new: 'รอ Claude', doing: 'กำลังทำ', done: 'เสร็จแล้ว', dropped: 'ไม่ได้ทำ' }
const OWED_SHOW = 4
const CMD_SHOW = 5
const POLL_MS = 30000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const parts = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return { y, m, d, wd: new Date(y, m - 1, d).getDay() }
}
const fmtShort = (iso) => { const p = parts(iso); return `${p.d} ${MON[p.m - 1]}` }
const fmtWhen = (iso) => {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  return `${t.getDate()} ${MON[t.getMonth()]} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}
const num = (n) => Number(n || 0).toLocaleString('en-US')
const isOpenCmd = (c) => c.status === 'new' || c.status === 'doing'
const hashDate = () => {
  const h = decodeURIComponent((window.location.hash || '').slice(1))
  return DATE_RE.test(h) ? h : null
}

// ข้อความในบันทึกเป็นข้อความธรรมดา — รองรับแค่ `โค้ด` กับ **ตัวหนา**
function Inline({ text }) {
  const s = String(text ?? '')
  const out = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    out.push(m[1] != null ? <code key={i++}>{m[1]}</code> : <strong key={i++}>{m[2]}</strong>)
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return <>{out}</>
}

function Ref({ r }) {
  const id = String(r?.id || '')
  if (r?.type === 'commit') return <a className="dy-ref" href={`${REPO}/commit/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer">{id}</a>
  if (r?.type === 'daily') return <a className="dy-ref dy-ref-wl" href={`${REPO}/blob/main/docs/daily/${encodeURIComponent(id)}.md`} target="_blank" rel="noopener noreferrer">{id}</a>
  if (r?.type === 'file') return <a className="dy-ref dy-ref-wl" href={`${REPO}/blob/main/${id.split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noopener noreferrer">{id}</a>
  return <span className="dy-ref dy-ref-wl">{id}</span>
}

async function api(body) {
  const init = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }
    : { credentials: 'same-origin', cache: 'no-store' }
  const res = await fetch('/api/diary', init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

function choiceLine(p, inDay) {
  if (!p.choice) return inDay ? 'ยังไม่ได้เลือก' : 'ยังไม่ได้เลือก · เลือกทางได้ที่หน้าของวัน'
  const o = (p.options || []).find((x) => x.id === p.choice)
  const label = p.choice === 'other' ? `อื่น ๆ: ${p.choice_note || ''}` : (o ? o.label : p.choice)
  return <>เลือก <b>{label}</b> · {p.acted ? 'Claude ทำแล้ว' : 'Claude จะทำตอนคุยครั้งถัดไป'}</>
}

export default function DiaryPage({ onLogout }) {
  const [days, setDays] = useState([])
  const [cmds, setCmds] = useState([])
  const [load, setLoad] = useState({ phase: 'loading', message: '' })
  const [sel, setSel] = useState(hashDate)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState({})
  const [err, setErr] = useState('')
  const [owedAll, setOwedAll] = useState(false)
  const [cmdsAll, setCmdsAll] = useState(false)
  const [other, setOther] = useState(null)
  const [otherText, setOtherText] = useState('')
  const [cmdText, setCmdText] = useState('')
  const [cmdBusy, setCmdBusy] = useState(false)
  const [cmdErr, setCmdErr] = useState('')

  const refresh = useCallback(async (silent) => {
    try {
      const data = await api()
      setDays(Array.isArray(data.days) ? data.days.filter((d) => d && DATE_RE.test(d.date)) : [])
      setCmds(Array.isArray(data.commands) ? data.commands : [])
      setLoad({ phase: 'ready', message: '' })
    } catch (error) {
      if (error.status === 401) { window.location.assign('/'); return }
      if (!silent) setLoad({ phase: 'error', message: error.message })
    }
  }, [])

  useEffect(() => {
    refresh(false)
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(true) }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])

  const selected = useMemo(() => days.find((d) => d.date === sel) || days[0] || null, [days, sel])

  const select = (date) => {
    if (!days.some((d) => d.date === date)) return
    setSel(date)
    try { window.history.replaceState(null, '', `#${date}`) } catch { window.location.hash = date }
    if (window.matchMedia('(max-width: 860px)').matches) {
      requestAnimationFrame(() => document.querySelector('.dy-sheet')?.scrollIntoView({ block: 'start' }))
    }
  }

  const replaceDay = (day) => setDays((list) => list.map((d) => (d.date === day.date ? day : d)))

  const updatePending = async (date, pid, patch) => {
    const day = days.find((d) => d.date === date)
    if (!day || busy[date]) return false
    setBusy((b) => ({ ...b, [date]: true }))
    setErr('')
    try {
      const data = await api({ action: 'pending', date, pid, version: day.version, patch })
      if (data.day) replaceDay(data.day)
      return true
    } catch (error) {
      if (error.status === 401) { window.location.assign('/'); return false }
      if (error.status === 409) {
        if (error.data?.day) replaceDay(error.data.day); else refresh(true)
        setErr('บันทึกถูกแก้จากที่อื่นก่อน โหลดใหม่ให้แล้ว ลองอีกครั้ง')
      } else {
        setErr(error.message || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
      return false
    } finally {
      setBusy((b) => { const next = { ...b }; delete next[date]; return next })
    }
  }

  const choose = (date, pid, choice, note) => updatePending(date, pid, note ? { choice, choice_note: note } : { choice })
  const toggleDone = (date, pid, want) => updatePending(date, pid, { done: want })

  const sendCommand = async (e) => {
    e.preventDefault()
    const text = cmdText.trim()
    if (!text || cmdBusy) return
    setCmdBusy(true)
    setCmdErr('')
    try {
      const data = await api({ action: 'command', text })
      if (data.command) setCmds((list) => [data.command, ...list])
      setCmdText('')
    } catch (error) {
      if (error.status === 401) { window.location.assign('/'); return }
      setCmdErr(error.message || 'ส่งคำสั่งไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setCmdBusy(false)
    }
  }

  const visibleDays = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return days
    return days.filter((d) => JSON.stringify(d).toLowerCase().includes(needle))
  }, [days, q])

  const owed = useMemo(() => {
    const open = []
    for (const d of days) for (const p of d.pending || []) if (p && !p.done) open.push({ d, p })
    return open
  }, [days])

  const openCmds = cmds.filter(isOpenCmd)
  const closedCmds = cmds.filter((c) => !isOpenCmd(c))
  const shownClosed = cmdsAll ? closedCmds : closedCmds.slice(0, CMD_SHOW)
  const shownOwed = owedAll ? owed : owed.slice(0, OWED_SHOW)

  const renderOptions = (d, p) => {
    const dis = Boolean(busy[d.date]) || Boolean(p.done)
    const key = `${d.date}|${p.id}`
    return (
      <>
        <div className="dy-opts">
          {p.options.map((o) => (
            <button key={o.id} type="button" className="dy-opt" aria-pressed={p.choice === o.id} disabled={dis}
              onClick={() => choose(d.date, p.id, o.id)}>
              {o.label}
              {p.recommended === o.id && <span className="dy-rec">★ แนะนำ</span>}
              {o.note && <small>{o.note}</small>}
            </button>
          ))}
          <button type="button" className="dy-opt" aria-pressed={p.choice === 'other'} disabled={dis}
            onClick={() => { setOther(other === key ? null : key); setOtherText('') }}>
            อื่น ๆ (พิมพ์เอง)
            {p.choice === 'other' && p.choice_note && <small>{p.choice_note}</small>}
          </button>
        </div>
        {other === key && !dis && (
          <form className="dy-other" onSubmit={async (e) => {
            e.preventDefault()
            const txt = otherText.trim()
            if (!txt) return
            setOther(null)
            setOtherText('')
            await choose(d.date, p.id, 'other', txt)
          }}>
            <input type="text" value={otherText} onChange={(e) => setOtherText(e.target.value)} autoFocus
              placeholder="พิมพ์ทางที่ต้องการให้ Claude ทำ" aria-label="ทางเลือกอื่น" />
            <button className="dy-btn dy-ghost" type="submit">บันทึก</button>
          </form>
        )}
        <div className="dy-choice">{choiceLine(p, true)}</div>
      </>
    )
  }

  const renderTodo = (d, p, mode) => {
    const id = `${mode}-${d.date}-${p.id}`
    const hasOptions = p.owner === 'decide' && Array.isArray(p.options) && p.options.length > 0
    return (
      <li key={id} className={p.done ? 'dy-done' : ''}>
        <input type="checkbox" id={id} checked={Boolean(p.done)} disabled={Boolean(busy[d.date])}
          onChange={(e) => toggleDone(d.date, p.id, e.target.checked)} />
        <div>
          <label htmlFor={id}><Inline text={p.text} /></label>
          {OWNER[p.owner] && <span className={`dy-owner dy-owner-${p.owner}`}>{OWNER[p.owner]}</span>}
          {mode === 'o' && <a className="dy-from" href={`#${d.date}`} onClick={(e) => { e.preventDefault(); select(d.date) }}>{fmtShort(d.date)}</a>}
          {hasOptions && (mode === 'd' ? renderOptions(d, p) : <div className="dy-choice">{choiceLine(p, false)}</div>)}
        </div>
      </li>
    )
  }

  const renderSpine = () => {
    if (!visibleDays.length) return <li className="dy-note">ไม่มีวันที่ตรงกับคำค้น</li>
    const items = []
    let lastMonth = ''
    for (const d of visibleDays) {
      const p = parts(d.date)
      const mk = `${p.y}-${p.m}`
      if (mk !== lastMonth) {
        items.push(<li key={`m-${mk}`} className="dy-month">{MON_FULL[p.m - 1]} {p.y}</li>)
        lastMonth = mk
      }
      items.push(
        <li key={d.date}>
          <button type="button" className="dy-day-btn" aria-current={selected?.date === d.date ? 'true' : 'false'} onClick={() => select(d.date)}>
            <span className="dy-num">{p.d}</span>
            <span className="dy-meta">
              <span className="dy-wd">{WD[p.wd]} · {MON[p.m - 1]}</span>
              <span className="dy-tt">{d.title || ''}</span>
            </span>
          </button>
        </li>,
      )
    }
    return items
  }

  const renderDay = (d) => {
    const p = parts(d.date)
    const st = d.stats || {}
    const chips = [
      st.commits != null && <span key="c" className="dy-chip">{num(st.commits)} commit</span>,
      st.files != null && <span key="f" className="dy-chip">{num(st.files)} ไฟล์</span>,
      st.added != null && <span key="l" className="dy-chip">+{num(st.added)} / −{num(st.deleted)} บรรทัด</span>,
      ...(d.areas || []).map((a) => <span key={`a-${a}`} className="dy-chip dy-area">{a}</span>),
    ].filter(Boolean)
    return (
      <article className="dy-sheet" aria-labelledby="dy-day-h">
        <div className="dy-stamp">
          <span className="dy-big">{p.d}</span>
          <span className="dy-wd">วัน{WD[p.wd]}</span>
          <span className="dy-my">{MON_FULL[p.m - 1]} {p.y}</span>
        </div>
        <div className="dy-streak" aria-hidden="true" />
        <h2 id="dy-day-h"><Inline text={d.title || fmtShort(d.date)} /></h2>
        {d.story && <p className="dy-story"><Inline text={d.story} /></p>}
        {chips.length > 0 && <div className="dy-chips">{chips}</div>}
        {(d.highlights || []).length > 0 && (
          <section className="dy-sec"><h3>ภาพรวม</h3>
            <ul className="dy-high">{d.highlights.map((h, i) => <li key={i}><Inline text={h} /></li>)}</ul>
          </section>
        )}
        {(d.stories || []).length > 0 && (
          <section className="dy-sec"><h3>งานที่ทำ</h3>
            <ol className="dy-works">
              {d.stories.map((w, i) => {
                const rows = [['เปลี่ยนอะไร', w.what], ['ทำไม', w.why], ['ผล', w.result], ['นอกรีโป', w.outside]].filter(([, v]) => v)
                return (
                  <li key={i} className="dy-work">
                    <h4><Inline text={w.title} /></h4>
                    {rows.length > 0 && <dl>{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd><Inline text={v} /></dd></React.Fragment>)}</dl>}
                    {(w.refs || []).length > 0 && <div className="dy-refs">{w.refs.map((r, j) => <Ref key={j} r={r} />)}</div>}
                  </li>
                )
              })}
            </ol>
          </section>
        )}
        {(d.decisions || []).length > 0 && (
          <section className="dy-sec"><h3>การตัดสินใจของเจ้าของ</h3>
            <div className="dy-dec-wrap">
              <table className="dy-dec">
                <thead><tr><th>เรื่อง</th><th>เลือก</th><th>ไม่เลือก</th></tr></thead>
                <tbody>
                  {d.decisions.map((x, i) => (
                    <tr key={i}><td><Inline text={x.topic} /></td><td className="dy-ch"><Inline text={x.chose} /></td><td className="dy-no"><Inline text={x.rejected || '—'} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {(d.pending || []).length > 0 && (
          <section className="dy-sec"><h3>ค้าง / รอตัดสินใจ</h3>
            <ul className="dy-todo">{d.pending.map((x) => renderTodo(d, x, 'd'))}</ul>
            <p className="dy-note">ติ๊ก = เรื่องนั้นจบแล้ว · ข้อ "รอเลือก" กดเลือกทางได้เลย Claude จะทำตามตอนคุยครั้งถัดไป · อยากสั่งงานใหม่ใช้กล่อง "สั่งงาน Claude" ด้านบน</p>
          </section>
        )}
        {err && <p className="dy-err">{err}</p>}
      </article>
    )
  }

  const renderMain = () => {
    if (load.phase === 'loading') {
      return <div className="dy-empty"><h2>กำลังเปิดสมุด…</h2><p>บันทึกของแต่ละวันจะขึ้นที่นี่ — Claude เพิ่มหน้าใหม่ให้หลังจบงานของวันนั้น</p></div>
    }
    if (load.phase === 'error') {
      return (
        <div className="dy-empty">
          <h2>เปิดสมุดไม่ได้</h2>
          <p className="dy-err">{load.message}</p>
          <button type="button" className="dy-btn" onClick={() => { setLoad({ phase: 'loading', message: '' }); refresh(false) }}>ลองใหม่</button>
        </div>
      )
    }
    if (!days.length || !selected) {
      return <div className="dy-empty"><h2>ยังไม่มีบันทึก</h2><p>หน้าของแต่ละวันจะขึ้นที่นี่หลังจบงาน — Claude เป็นคนเพิ่มให้จากสรุปประจำวัน</p></div>
    }
    return (
      <div className="dy-book">
        <nav className="dy-spine" aria-label="วันที่มีบันทึก">
          <input className="dy-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นในบันทึก เช่น ภาษี · โฉนด · วงเงินเพิ่ม" aria-label="ค้นในบันทึก" />
          <ul className="dy-days">{renderSpine()}</ul>
        </nav>
        {renderDay(selected)}
      </div>
    )
  }

  return (
    <div className="dy-root">
      <div className="dy-wrap">
        <header className="dy-top">
          <div className="dy-bar">
            <span className="dy-lock">
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              ส่วนตัว · เปิดได้หลังล็อกอิน AssetX
            </span>
            <span className="dy-links">
              <a href="/">← หน้าหลัก</a>
              {onLogout && <button type="button" className="dy-link-btn" onClick={onLogout}>ออกจากระบบ</button>}
            </span>
          </div>
          <h1>ไดอารี่งาน <span className="dy-spark">AssetX</span></h1>
          <p className="dy-lede">เรื่องราวการทำงานแต่ละวันของ AssetX Estate (ระบบประเมินอสังหาฯ จำนอง/ขายฝาก และแจ้งเตือนดอกเบี้ย) — วันนั้นเปลี่ยนอะไร ทำไม ตัดสินใจอะไร และอะไรยังค้าง</p>
        </header>

        {load.phase === 'ready' && (
          <section className="dy-card dy-cmd" aria-labelledby="dy-cmd-h">
            <h2 id="dy-cmd-h">สั่งงาน Claude {openCmds.length > 0 && <span className="dy-n">{openCmds.length} รอทำ</span>}</h2>
            <p className="dy-note">พิมพ์สิ่งที่อยากให้ Claude ทำ — Claude จะอ่านตอนเริ่มคุยครั้งถัดไป ทำให้ แล้วกลับมาเปลี่ยนสถานะและเขียนผลไว้ที่นี่</p>
            <form onSubmit={sendCommand}>
              <textarea value={cmdText} onChange={(e) => setCmdText(e.target.value)} maxLength={2000}
                placeholder="เช่น ใส่ราคาประเมินราชการของโฉนด … · ตรวจว่า Vercel deploy ล่าสุดผ่านไหม" aria-label="คำสั่งงานถึง Claude" />
              <button className="dy-btn" type="submit" disabled={cmdBusy || !cmdText.trim()}>{cmdBusy ? 'กำลังส่ง…' : 'ส่งให้ Claude'}</button>
            </form>
            {cmdErr && <p className="dy-err">{cmdErr}</p>}
            <ul className="dy-cmds">
              {[...openCmds, ...shownClosed].map((c) => (
                <li key={c.id}>
                  <div>
                    <div className="dy-t"><Inline text={c.text} /></div>
                    <div className="dy-when">{fmtWhen(c.created_at)}{c.done_at ? ` · ปิดงาน ${fmtWhen(c.done_at)}` : ''}</div>
                    {c.result && <div className="dy-res"><Inline text={c.result} /></div>}
                  </div>
                  <span className={`dy-st dy-st-${c.status}`}>{ST[c.status] || c.status}</span>
                </li>
              ))}
              {cmds.length === 0 && <li className="dy-note">ยังไม่มีคำสั่ง — พิมพ์ด้านบนแล้วกดส่ง</li>}
            </ul>
            {closedCmds.length > CMD_SHOW && (
              <button type="button" className="dy-more" onClick={() => setCmdsAll((v) => !v)}>
                {cmdsAll ? 'ย่อรายการที่เสร็จแล้ว' : `ดูที่เสร็จแล้วอีก ${closedCmds.length - CMD_SHOW} รายการ`}
              </button>
            )}
          </section>
        )}

        {owed.length > 0 && (
          <section className="dy-card" aria-labelledby="dy-owed-h">
            <h2 id="dy-owed-h">ยังค้างอยู่ <span className="dy-n">{owed.length} เรื่อง</span></h2>
            <ul className="dy-todo">{shownOwed.map(({ d, p }) => renderTodo(d, p, 'o'))}</ul>
            {owed.length > OWED_SHOW && (
              <button type="button" className="dy-more" onClick={() => setOwedAll((v) => !v)}>
                {owedAll ? 'ย่อรายการ' : `ดูอีก ${owed.length - OWED_SHOW} เรื่อง`}
              </button>
            )}
          </section>
        )}

        {renderMain()}
      </div>
    </div>
  )
}
