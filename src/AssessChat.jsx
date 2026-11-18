import React, { useEffect, useRef, useState } from 'react'

// หน้าต่างสอบถามของหน้า /assess (สาธารณะ) — แยกจาก ChatPanel ของแอปภายใน: หน้าตาเรียบตาม assess.css
// ไม่ส่งข้อมูลลูกค้าในระบบ และบอกผู้ใช้ชัดว่าเป็นผู้ช่วยอัตโนมัติ
const QUICK = [
  'จำนองกับขายฝากต่างกันอย่างไร',
  'ถ้าไถ่คืนไม่ทันจะเกิดอะไรขึ้น',
  'ต้องเตรียมเอกสารอะไรบ้าง',
  'หลังส่งแบบฟอร์มแล้วมีขั้นตอนอะไรต่อ',
]
const MAX_QUESTION = 500

export default function AssessChat({ phone }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [partial, setPartial] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, partial, loading])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const ask = async (raw) => {
    const question = String(raw ?? input).trim().slice(0, MAX_QUESTION)
    if (!question || loading) return
    const history = [...messages, { role: 'user', content: question }]
    setMessages(history)
    setInput('')
    setLoading(true)
    setPartial('')
    let answer = ''
    try {
      const res = await fetch('/api/assess-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) }),
      })
      if (!res.ok || !res.body) throw new Error('bad response')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
          try { answer += JSON.parse(line.slice(6)).text || '' } catch { /* ข้ามบรรทัดที่ไม่ครบ */ }
        }
        setPartial(answer)
      }
    } catch {
      answer = ''
    }
    const text = answer.replace(/\*\*/g, '').trim()
      || `ขออภัยครับ ตอนนี้ระบบตอบคำถามไม่ได้ กรุณากรอกแบบฟอร์มให้ทีมงานติดต่อกลับ${phone ? ` หรือโทร ${phone}` : ''}`
    setMessages([...history, { role: 'assistant', content: text }])
    setPartial('')
    setLoading(false)
  }

  return (
    <>
      <button type="button" className="as-chat-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'ปิด' : 'สอบถาม'}
      </button>
      {open && (
        <section className="as-chat" aria-label="สอบถามข้อมูล">
          <header className="as-chat-head">
            <div>
              <strong>สอบถามข้อมูลขายฝากและจำนอง</strong>
              <small>ตอบโดยผู้ช่วยอัตโนมัติ เป็นข้อมูลทั่วไป</small>
            </div>
            <button type="button" className="as-link" onClick={() => setOpen(false)}>ปิด</button>
          </header>
          <div className="as-chat-body">
            {messages.length === 0 && !loading && (
              <div className="as-chat-quick">
                <p>คำถามที่พบบ่อย</p>
                {QUICK.map((q) => <button key={q} type="button" onClick={() => ask(q)}>{q}</button>)}
              </div>
            )}
            {messages.map((m, i) => <div key={i} className="as-msg" data-role={m.role}>{m.content}</div>)}
            {loading && <div className="as-msg" data-role="assistant" data-pending={!partial}>{partial || 'กำลังหาคำตอบ…'}</div>}
            <div ref={endRef} />
          </div>
          <form className="as-chat-form" onSubmit={(e) => { e.preventDefault(); ask() }}>
            <input ref={inputRef} className="as-input" value={input} maxLength={MAX_QUESTION} disabled={loading} onChange={(e) => setInput(e.target.value)} placeholder="พิมพ์คำถาม" aria-label="พิมพ์คำถาม" />
            <button type="submit" className="as-btn as-btn-primary" disabled={loading || !input.trim()}>ส่ง</button>
          </form>
          {phone && <footer className="as-chat-foot">ต้องการคุยกับเจ้าหน้าที่ โทร {phone}</footer>}
        </section>
      )}
    </>
  )
}
