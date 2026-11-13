// node --test src/lib/deedTypes.test.mjs — ความรู้ประเภทเอกสารสิทธิ์ + การต่อเข้ากับคะแนนประเมินและธงเตือน
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEED_TYPES, DEED_SOURCES, GENERAL_RESTRICTIONS, TX_STATUS, DEED_RIGHTS, DEED_GROUPS, LEGACY_TITLE, TITLE_ENCUMBRANCES,
  deedVerdict, deedTypeKeyFor, formDeedTypeKeys, strictestDeedType, effectiveTitleType, legacyTitleType,
  splitLegacyTitleType, deedPolicyFlags, deedRiskText, deedSource, txForAssessment,
} from './deedTypes.js'
import { TITLE_TYPES, computeValuation } from './valuationOptions.js'
import { buildUnderwritingPolicy } from './underwritingPolicy.js'

const allText = (obj) => JSON.stringify(obj)

test('ทุกประเภทเอกสารมีข้อมูลครบและอ้างแหล่งที่มีอยู่จริง', () => {
  const keys = new Set()
  for (const t of DEED_TYPES) {
    assert.ok(!keys.has(t.key), `key ซ้ำ ${t.key}`)
    keys.add(t.key)
    for (const field of ['code', 'name', 'issuer', 'summary']) assert.ok(t[field], `${t.key} ขาด ${field}`)
    assert.ok(DEED_RIGHTS[t.right], `${t.key} right ไม่รู้จัก`)
    assert.ok(DEED_GROUPS[t.group], `${t.key} group ไม่รู้จัก`)
    assert.ok(['title', 'ns3k', 'ns3', 'severe'].includes(t.scoreAs), `${t.key} scoreAs`)
    for (const tx of ['sell', 'khaifak', 'jamnong']) {
      const e = t.tx[tx]
      assert.ok(e && TX_STATUS[e.s], `${t.key}.${tx} สถานะไม่รู้จัก`)
      assert.ok(e.note, `${t.key}.${tx} ไม่มีคำอธิบาย`)
      if (e.s === 'check') assert.ok(['medium', 'high'].includes(e.level), `${t.key}.${tx} ต้องมี level`)
    }
    assert.ok(Array.isArray(t.limits) && Array.isArray(t.checks))
    assert.ok(t.refs.length > 0, `${t.key} ไม่มีที่มา`)
    for (const r of t.refs) assert.ok(deedSource(r), `${t.key} อ้างแหล่งที่ไม่มี: ${r.src}`)
  }
  for (const g of GENERAL_RESTRICTIONS) {
    assert.ok(g.title && g.rule && g.check && ['block', 'consent', 'risk'].includes(g.effect), g.key)
    for (const r of g.refs) assert.ok(deedSource(r), `${g.key} อ้างแหล่งที่ไม่มี: ${r.src}`)
  }
  for (const [id, s] of Object.entries(DEED_SOURCES)) {
    assert.match(s.url, /^https:\/\//, `${id} url`)
    assert.ok(s.title && typeof s.official === 'boolean', id)
  }
})

test('ไฟล์ความรู้ไม่มีอัตราดอกเบี้ย เบอร์โทร หรือวงเงินของบริษัท (รีโปสาธารณะ)', () => {
  const text = allText({ DEED_TYPES, GENERAL_RESTRICTIONS })
  assert.doesNotMatch(text, /ดอกเบี้ย\s*\d|\d+(\.\d+)?\s*%\s*(ต่อ|\/)\s*(เดือน|ปี)/)
  assert.doesNotMatch(text, /0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}/)
  assert.doesNotMatch(text, /\d[\d,]*\s*บาท/)
})

test('เอกสารที่กฎหมายห้ามโอน/ไม่ใช่หนังสือแสดงสิทธิ ขายฝากไม่ได้ · โฉนดและ น.ส.3 ทุกแบบขายฝากได้', () => {
  for (const key of ['spk401', 'kaset', 'sk1', 'baijong', 'nk3', 'forest', 'pbt5', 'titleBan', 'ratchaphatsadu', 'lease', 'lease2542']) {
    assert.equal(deedVerdict(key, 'ขายฝาก').status, 'no', key)
    assert.equal(deedVerdict(key, 'ขายฝาก').blocks, true, key)
  }
  assert.equal(deedVerdict('chanote', 'ขายฝาก').status, 'yes')
  assert.equal(deedVerdict('ns3k', 'ขายฝาก').status, 'yes')
  assert.equal(deedVerdict('ns3', 'ขายฝาก').status, 'check')
  assert.equal(deedVerdict('ns3b', 'จำนอง').status, 'check')
  // ห้ามโอน: จดจำนองได้ แต่บังคับจำนองไม่ได้ระหว่างห้ามโอน
  assert.equal(deedVerdict('titleBan', 'จำนอง').status, 'check')
  assert.equal(deedVerdict('titleBan', 'จำนอง').severity, 'high')
  assert.equal(txForAssessment('ประเมินเพื่อสินเชื่อ'), 'jamnong')
  assert.equal(deedVerdict('chanote', 'ประเมินมูลค่าทรัพย์สิน'), null)
})

test('titleType เดิมทุกค่าแปลงไป-กลับได้คะแนนเท่าเดิม', () => {
  for (const v of Object.values(LEGACY_TITLE)) assert.ok(TITLE_TYPES.some((t) => t.value === v), `ไม่มีใน TITLE_TYPES: ${v}`)
  for (const t of TITLE_TYPES) {
    for (const assessmentType of ['ขายฝาก', 'จำนอง', 'ประเมินมูลค่าทรัพย์สิน']) {
      const form = { titleType: t.value, assessmentType, propertySubtype: 'ที่ดินเปล่า (โฉนด)', deeds: [{}] }
      assert.equal(effectiveTitleType(form), t.value, `${t.value} / ${assessmentType}`)
    }
  }
  for (const e of TITLE_ENCUMBRANCES) assert.ok(['free', 'mortgaged', 'severe'].includes(e.value))
})

test('computeValuation: ข้อมูลเก่าได้คะแนนเอกสารเท่าเดิม · ประเภทรายแปลงคิดตามเอกสารที่จำกัดที่สุด', () => {
  const base = { assessmentType: 'ขายฝาก', propertySubtype: 'ที่ดินเปล่า (โฉนด)', deeds: [{ areaRai: 0, areaNgan: 1, areaSqw: 0, govPrice: 10000 }], risks: {}, floodLevel: 'ไม่มีประวัติน้ำท่วม' }
  for (const t of TITLE_TYPES) assert.equal(computeValuation({ ...base, titleType: t.value }).riskScore, t.score, t.value)
  const score = (patch) => computeValuation({ ...base, ...patch }).riskScore
  assert.equal(score({ deeds: [{ ...base.deeds[0], docType: 'ns3k' }] }), 5)
  assert.equal(score({ deeds: [{ ...base.deeds[0], docType: 'chanote' }, { ...base.deeds[0], docType: 'ns3' }] }), 8)
  assert.equal(score({ deeds: [{ ...base.deeds[0], docType: 'chanote' }], titleEncumbrance: 'mortgaged' }), 3)
  assert.equal(score({ deeds: [{ ...base.deeds[0], docType: 'condo' }], titleEncumbrance: 'free' }), 0)
  assert.equal(score({ deeds: [{ ...base.deeds[0], docType: 'spk401' }] }), 18)
  // ประเภทย่อยที่บอกเอกสารอยู่แล้ว ใช้เป็นค่าตั้งต้นของแปลงที่ยังไม่ได้เลือก
  assert.equal(score({ propertySubtype: 'ที่ดินเปล่า (ส.ค.1)' }), 18)
  assert.equal(score({ propertySubtype: 'ที่ดินเปล่า (น.ส.3)' }), 8)
})

test('ประเภทเอกสารของแปลง: เลือกเอง > ประเภทย่อย > titleType เดิม > โฉนด', () => {
  assert.equal(deedTypeKeyFor({ docType: 'ns3b' }, { propertySubtype: 'ที่ดินเปล่า (ส.ค.1)' }), 'ns3b')
  assert.equal(deedTypeKeyFor({}, { propertySubtype: 'คอนโดมิเนียม' }), 'condo')
  assert.equal(deedTypeKeyFor({}, { titleType: LEGACY_TITLE.ns3k }), 'ns3k')
  assert.equal(deedTypeKeyFor({ docType: 'ไม่มีจริง' }, {}), 'chanote')
  assert.deepEqual(formDeedTypeKeys({ deeds: [{ docType: 'chanote' }, { docType: 'chanote' }, { docType: 'ns3' }] }), ['chanote', 'ns3'])
  assert.equal(strictestDeedType(['chanote', 'ns3', 'spk401'], 'ขายฝาก'), 'spk401')
  assert.equal(strictestDeedType(['chanote', 'ns3k'], 'ขายฝาก'), 'ns3k') // เสมอกัน (ได้ทั้งคู่) ใช้ตัวที่จำกัดกว่าตามลำดับ
  assert.deepEqual(splitLegacyTitleType(LEGACY_TITLE.chanoteMortgaged), { deedType: 'chanote', encumbrance: 'mortgaged' })
  assert.equal(legacyTitleType('condo', 'mortgaged'), LEGACY_TITLE.chanoteMortgaged)
})

test('underwriting: เอกสารที่ทำธุรกรรมไม่ได้ → Decline · มีเงื่อนไข → ธงตามระดับ · โฉนดปลอดภาระ → ไม่มีธงเอกสาร', () => {
  const calc = { riskScore: 0, fsv: 1_000_000, marketValue: 1_000_000, recommendedLoan: 500_000, riskBand: { ltvMax: 60 } }
  const form = (deedType, patch = {}) => ({ assessmentType: 'ขายฝาก', propertySubtype: 'ที่ดินเปล่า (โฉนด)', deeds: [{ docType: deedType }], risks: {}, floodLevel: 'ไม่มีประวัติน้ำท่วม', titleEncumbrance: 'free', ...patch })

  const spk = buildUnderwritingPolicy(form('spk401'), calc)
  assert.match(spk.decision.status, /^Decline \/ เอกสาร/)
  assert.ok(spk.activeFlags.some((f) => f.key === 'deed:spk401' && f.blocks))

  const ns3 = buildUnderwritingPolicy(form('ns3'), calc)
  assert.doesNotMatch(ns3.decision.status, /^Decline/)
  assert.equal(ns3.activeFlags.find((f) => f.key === 'deed:ns3').severity, 'medium')
  assert.ok(ns3.conditions.some((c) => c.includes('ประกาศ 30 วัน')))

  const chanote = buildUnderwritingPolicy(form('chanote'), calc)
  assert.equal(chanote.activeFlags.filter((f) => f.key.startsWith('deed:')).length, 0)
  assert.equal(deedRiskText(form('chanote')), '')

  const banMortgage = buildUnderwritingPolicy(form('titleBan', { assessmentType: 'จำนอง' }), calc)
  assert.equal(banMortgage.activeFlags.find((f) => f.key === 'deed:titleBan').severity, 'high')

  const mortgaged = deedPolicyFlags(form('chanote', { titleEncumbrance: 'mortgaged' }))
  assert.ok(mortgaged.some((f) => f.key === 'encumbrance:mortgaged' && f.severity === 'medium'))

  // น.ส.3 ก ทำได้ แต่ยังได้ธงตรวจการครอบครองเหมือนธง titleType เดิม
  assert.ok(deedPolicyFlags(form('ns3k')).some((f) => f.key === 'deed:ns3k' && f.severity === 'medium'))
  assert.match(deedRiskText(form('sk1')), /ส\.ค\.1: ขายฝากไม่ได้/)
})
