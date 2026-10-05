import assert from 'node:assert/strict'
import { renderArtwork } from './marketingArtwork.js'

const draws = []
const loads = []
const oldImage = globalThis.Image
const oldDocument = globalThis.document
globalThis.Image = class {
  width = 1122
  height = 1402
  set src(value) { loads.push(value); queueMicrotask(() => this.onload()) }
}
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas')
    return {
      getContext() {
        return {
          fillRect() {},
          drawImage(...args) { draws.push(args) },
          fillText() { assert.fail('Finished posters must not get text overlays') },
        }
      },
      toDataURL() { return 'data:image/jpeg;base64,dGVzdA==' },
    }
  },
}
try {
  const result = await renderArtwork('poster.png', {
    layout: 'original', format: 'square', headline: '', zoom: 2, cropX: 0, cropY: 100,
  })
  assert.deepEqual(loads, ['poster.png'])
  assert.equal(draws.length, 1)
  assert.equal(draws[0].length, 3)
  assert.deepEqual(draws[0].slice(1), [0, 0])
  assert.equal(result.width, 1122)
  assert.equal(result.height, 1402)
  assert.equal(result.mimeType, 'image/jpeg')
} finally {
  globalThis.Image = oldImage
  globalThis.document = oldDocument
}
console.log('marketing artwork tests passed')
