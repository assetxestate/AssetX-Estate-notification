import test from 'node:test'
import assert from 'node:assert/strict'
import { BRAND_PROFILES, brandList, brandProfile, brandPromptLines, brandWarnings, cleanBrandId, effectiveBrand, saveBrandSettings } from './marketingBrands.js'

test('มีสองแบรนด์ รหัสที่ไม่รู้จักตกเป็น Estate', () => {
  assert.deepEqual(brandList().map((brand) => brand.id), ['assetx_estate', 'assetx_research'])
  assert.equal(cleanBrandId('nope'), 'assetx_estate')
  assert.equal(brandProfile('assetx_research').name, 'AssetX Research')
  assert.equal(brandProfile(undefined).id, 'assetx_estate')
})

test('ทั้งสองแบรนด์พูดกับเจ้าของทรัพย์ (เจ้าของเลือก 23 พ.ย. 2569) — ไม่มีมุมนักลงทุนในโปรไฟล์', () => {
  for (const brand of brandList()) {
    assert.match(brand.purpose, /เจ้าของทรัพย์/)
    assert.doesNotMatch(JSON.stringify({ ...brand, offTone: undefined }), /นักลงทุน|คนปล่อยเงิน|นายทุน/)
  }
})

test('AC-04: เปลี่ยนแบรนด์แล้วน้ำเสียง คำชวนทำ และข้อสังเกตเปลี่ยน โดยตัวโพสต์และข้ออ้างไม่ถูกแตะ', () => {
  const post = Object.freeze({ title: 'ราคานี้มาจากไหน', caption: 'ราคาเสนอขายของแปลงใกล้เคียงอยู่ในระดับใกล้กัน สนใจทักเลย ปรึกษาฟรี', claims: Object.freeze([{ id: 3 }]) })
  assert.deepEqual(brandWarnings(post, 'assetx_estate'), [])
  const research = brandWarnings(post, 'assetx_research')
  assert.ok(research.some((item) => /ขายตรง/.test(item)))
  assert.ok(research.some((item) => /ที่มาหรือวันที่/.test(item)))
  assert.notEqual(effectiveBrand('assetx_estate').cta, effectiveBrand('assetx_research').cta)
  assert.notEqual(effectiveBrand('assetx_estate').voice, effectiveBrand('assetx_research').voice)
  assert.deepEqual(post.claims, [{ id: 3 }])
})

test('Research พูดถึงบริการได้เมื่อบอกตรง ๆ ว่าเป็นผู้ให้บริการ · Estate เตือนถ้อยคำเร่ง', () => {
  const hidden = { caption: 'บทวิเคราะห์: ทำไมควรเลือกรับขายฝากกับเรา ข้อมูล ณ วันที่ 20 พ.ย. 2569' }
  assert.ok(brandWarnings(hidden, 'assetx_research').some((item) => /ผู้ให้บริการ/.test(item)))
  const open = { caption: 'AssetX Estate เป็นผู้ให้บริการรับขายฝาก บทนี้จึงเขียนจากมุมคนประเมิน ข้อมูล ณ วันที่ 20 พ.ย. 2569' }
  assert.deepEqual(brandWarnings(open, 'assetx_research'), [])
  assert.ok(brandWarnings({ caption: 'รีบเลย วันนี้เท่านั้น' }, 'assetx_estate').some((item) => /เร่ง/.test(item)))
})

test('ส่วนที่เจ้าของแก้ได้มีเวอร์ชัน · ข้อห้ามและข้อที่ต้องบอกผู้อ่านแก้จากการตั้งค่าไม่ได้', () => {
  let settings = saveBrandSettings({}, 'assetx_research', { cta: '  ส่งคำถามมาได้ครับ ', preferred: 'ที่มา\nข้อมูล ณ วันที่' }, new Date('2026-11-23T05:00:00Z'))
  assert.equal(settings.assetx_research.version, 1)
  settings = saveBrandSettings(settings, 'assetx_research', { cta: 'เก็บโพสต์นี้ไว้', preferred: [] })
  assert.equal(settings.assetx_research.version, 2)
  const brand = effectiveBrand('assetx_research', { ...settings, assetx_research: { ...settings.assetx_research, avoid: ['x'], disclosures: [], offTone: [] } })
  assert.equal(brand.cta, 'เก็บโพสต์นี้ไว้')
  assert.deepEqual(brand.preferred, BRAND_PROFILES.assetx_research.preferred)
  assert.deepEqual(brand.avoid, BRAND_PROFILES.assetx_research.avoid)
  assert.deepEqual(brand.disclosures, BRAND_PROFILES.assetx_research.disclosures)
  assert.equal(brand.settingsVersion, 2)
  assert.equal(effectiveBrand('assetx_estate', settings).cta, BRAND_PROFILES.assetx_estate.cta)
})

test('คำสั่งถึง AI ต่างกันตามแบรนด์', () => {
  assert.match(brandPromptLines('assetx_research').join('\n'), /ห้ามชวนใช้บริการ/)
  assert.match(brandPromptLines('assetx_estate').join('\n'), /ชวนส่งข้อมูลมาประเมินเบื้องต้น/)
})
