import assert from 'node:assert/strict'
import { parseParcelBoundary, parcelBoundaryToGeoJson } from './parcelBoundary.js'

const coordinateBoundary = parseParcelBoundary(`
13.4048, 101.1810
13.4050, 101.1815
13.4044, 101.1817
`)
assert.equal(coordinateBoundary.format, 'Coordinates')
assert.equal(coordinateBoundary.points.length, 3)

const geoJson = parcelBoundaryToGeoJson(coordinateBoundary.points, { source: 'test' })
assert.equal(geoJson.geometry.type, 'Polygon')
assert.equal(geoJson.geometry.coordinates[0].length, 4)

const importedGeoJson = parseParcelBoundary(JSON.stringify(geoJson), 'parcel.geojson')
assert.equal(importedGeoJson.format, 'GeoJSON')
assert.deepEqual(importedGeoJson.points, coordinateBoundary.points)

const multiPolygon = parseParcelBoundary(JSON.stringify({
  type: 'MultiPolygon',
  coordinates: [[[
    [101.1810, 13.4048],
    [101.1815, 13.4050],
    [101.1817, 13.4044],
    [101.1810, 13.4048],
  ]]],
}))
assert.equal(multiPolygon.points.length, 3)

assert.throws(() => parseParcelBoundary('13.4, 101.1\n13.5, 101.2'), /three valid points/)

console.log('parcelBoundary: all tests passed')
