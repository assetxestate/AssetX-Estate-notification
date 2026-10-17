import test from 'node:test'
import assert from 'node:assert/strict'
import { assetxImageStyles, buildAssetxStylePrompt, buildGalleryFireflyPrompt } from './assetxImageStyles.js'

test('all requested illustration styles are available with unique commands', () => {
  assert.deepEqual(assetxImageStyles.map((style) => style.name), [
    'Swiss Design', 'Clay Style', 'Cyberpunk', 'Collage Art', 'Minimalism',
    'Pop Art', 'Editorial', 'Handwritten', 'Aurora', 'Vector Art',
  ])
  assert.equal(new Set(assetxImageStyles.map((style) => style.id)).size, 10)
  assert.ok(assetxImageStyles.every((style) => style.artistic && style.photorealistic === false && !style.allowPosterText))
})

test('prompt uses the chosen style without claiming a real property', () => {
  const prompt = buildAssetxStylePrompt('clay-style', 'Explain land documents')
  assert.match(prompt, /Clay Style/)
  assert.match(prompt, /Explain land documents/)
  assert.match(prompt, /not depict a specific real client, property/)
  assert.throws(() => buildAssetxStylePrompt('unknown', 'Brief'))
  assert.throws(() => buildAssetxStylePrompt('clay-style', ''))
})

test('Firefly handoff gives each selected style a text-free image brief', () => {
  const artistic = buildGalleryFireflyPrompt(assetxImageStyles[0], 'Land checklist')
  assert.match(artistic, /Swiss Design/)
  assert.match(artistic, /Land checklist/)
  const original = buildGalleryFireflyPrompt({ name: 'Field Survey', prompt: 'Documentary look', scenes: 'Land entrance' }, 'Road access')
  assert.match(original, /Documentary look/)
  assert.match(original, /no text, letters, numbers/)
  assert.equal(buildGalleryFireflyPrompt(null, 'Brief'), '')
  const poster = buildGalleryFireflyPrompt({ name: 'Social Poster', allowPosterText: true, prompt: 'Render Thai text in the image' }, 'Land checklist')
  assert.doesNotMatch(poster, /Render Thai text/)
  assert.match(poster, /no text, letters, numbers, logos/)
  assert.doesNotThrow(() => buildGalleryFireflyPrompt(assetxImageStyles[0], 'x'.repeat(2001)))
  const contextual = buildGalleryFireflyPrompt({ name: 'Social Poster', allowPosterText: true }, {
    title: 'Sale with right of redemption: review terms before signing',
    imagePrompt: 'An illustrative contract review desk with a blank calendar and calculator.',
  })
  assert.match(contextual, /Content topic.*review terms before signing/)
  assert.match(contextual, /upper 20-25%/)
  assert.match(contextual, /no month names, dates, labels/)
  assert.match(buildGalleryFireflyPrompt({ name: 'Social Poster' }, { title: 'Property checklist' }), /Visual brief: Property checklist/)
})
