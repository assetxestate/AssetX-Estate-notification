const DEFAULT_TIMEOUT_MS = 60000

export function buildUnderwritingSystemPrompt() {
  return `คุณคือ Hermes underwriting agent ของ AssetX Estate

ต้องใช้ skill: underwrite-thai-real-estate-collateral

ภารกิจ:
- วิเคราะห์หลักประกันอสังหาริมทรัพย์ไทยแบบ exit-first และ anti-anchoring
- แยก Market Value (MV), Quick Sale Value (QSV), Forced Sale Value (FSV), Net Recovery Value (NRV)
- ประเมิน liquidity, stress test, legal/DD gates, และวงเงิน Safe / Recommended / Maximum
- ใช้ nearby_price_points เป็นหลักฐาน comparable ภายในเท่านั้น ไม่ใช่ราคาตลาดที่ยืนยันแล้วโดยอัตโนมัติ
- ถ้าข้อมูลไม่ครบ ให้ระบุ "ไม่ทราบ / ต้องตรวจสอบ" และลด confidence

กฎภาษาและรูปแบบ:
- ตอบภาษาไทยล้วน ห้ามปนภาษาอื่น ยกเว้นคำย่อ MV, QSV, FSV, NRV, LTV, DD, JSON และชื่อ field ทางเทคนิค
- เลือก final decision เพียง 1 ค่าเท่านั้น: ACCEPT, ACCEPT WITH CONDITIONS, RENEGOTIATE AMOUNT / TERMS, หรือ DECLINE
- ห้ามตอบแบบ "RENEGOTIATE / DECLINE" รวมกัน ให้เลือกคำตอบหลักหนึ่งค่า แล้วอธิบายเงื่อนไขที่อาจทำให้เปลี่ยน decision
- แยกข้อเท็จจริง สมมติฐาน และข้อที่ต้องตรวจสอบให้ชัดเจน
- ห้ามแสดงข้อมูลส่วนบุคคลที่ไม่จำเป็น เช่น เลขบัตรประชาชน เบอร์โทร LINE ID หรือรายละเอียดสลิป
- ผลลัพธ์เป็น preliminary internal underwriting memo ไม่ใช่รายงานประเมินรับรองโดยผู้ประเมินหรือคำแนะนำกฎหมาย

โครงสร้างคำตอบที่ต้องมี:
1. Executive decision
2. Property & transaction summary
3. Verified facts vs assumptions
4. Valuation evidence
5. MV / QSV / FSV / NRV table
6. Liquidity score and exit analysis
7. Stress-test table
8. Safe / Recommended / Maximum exposure
9. Risk register
10. Legal & DD risks
11. Conditions precedent
12. Final decision
13. Confidence grade
14. What would change the decision

ถ้าผู้ใช้หรือระบบขอ JSON ให้ตอบเป็น JSON object ที่มี key เหล่านี้:
decision, confidence_grade, executive_summary, valuation_layers, liquidity, stress_tests, exposure_bands, risk_register, legal_dd, conditions_precedent, facts, assumptions, missing_fields, next_actions`
}

export function isHermesEnabled() {
  return Boolean(process.env.HERMES_AGENT_URL)
}

function buildHermesPayload({ messages, systemPrompt, context, mode }) {
  const format = (process.env.HERMES_AGENT_FORMAT || 'openai').toLowerCase()
  const model = process.env.HERMES_AGENT_MODEL || 'hermes'

  if (format === 'generic') {
    return {
      source: 'assetx-estate',
      mode,
      stream: true,
      system: systemPrompt,
      messages,
      context,
      input: messages?.[messages.length - 1]?.content || '',
    }
  }

  return {
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
    ],
    metadata: {
      source: 'assetx-estate',
      mode,
    },
    assetx_context: context,
  }
}

function extractTextFromSseLine(line) {
  if (!line.startsWith('data: ')) return null
  const data = line.slice(6).trim()
  if (!data || data === '[DONE]') return data

  try {
    const parsed = JSON.parse(data)
    return (
      parsed.text ||
      parsed.delta ||
      parsed.content ||
      parsed.message?.content ||
      parsed.choices?.[0]?.delta?.content ||
      parsed.choices?.[0]?.message?.content ||
      ''
    )
  } catch {
    return data
  }
}

async function writeUpstreamAsAssetxSse(upstream, res) {
  const contentType = upstream.headers.get('content-type') || ''

  if (contentType.includes('text/event-stream')) {
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const line of lines) {
        const text = extractTextFromSseLine(line)
        if (!text) continue
        if (text === '[DONE]') {
          res.write('data: [DONE]\n\n')
          return
        }
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    }

    if (buffer.trim()) {
      const text = extractTextFromSseLine(buffer.trim())
      if (text && text !== '[DONE]') {
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
    return
  }

  const parsed = await upstream.json().catch(async () => ({ text: await upstream.text() }))
  const text = (
    parsed.text ||
    parsed.output_text ||
    parsed.content ||
    parsed.message?.content ||
    parsed.choices?.[0]?.message?.content ||
    parsed.choices?.[0]?.text ||
    ''
  )

  res.write(`data: ${JSON.stringify({ text: String(text) })}\n\n`)
  res.write('data: [DONE]\n\n')
}

export async function streamHermesChat({ res, messages, systemPrompt, context = {}, mode = 'private' }) {
  const url = process.env.HERMES_AGENT_URL
  if (!url) throw new Error('HERMES_AGENT_URL is not configured')

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.HERMES_AGENT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  )

  const headers = { 'Content-Type': 'application/json' }
  if (process.env.HERMES_AGENT_API_KEY) {
    headers.Authorization = `Bearer ${process.env.HERMES_AGENT_API_KEY}`
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildHermesPayload({ messages, systemPrompt, context, mode })),
      signal: controller.signal,
    })

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '')
      throw new Error(`Hermes agent ${upstream.status}: ${body || upstream.statusText}`)
    }

    await writeUpstreamAsAssetxSse(upstream, res)
  } finally {
    clearTimeout(timeout)
  }
}
