const validPoint = point => (
  Number.isFinite(point?.lat) &&
  Number.isFinite(point?.lng) &&
  point.lat >= -90 && point.lat <= 90 &&
  point.lng >= -180 && point.lng <= 180
)

function normalizePoints(points) {
  const normalized = points
    .map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
    .filter(validPoint)

  if (normalized.length > 3) {
    const first = normalized[0]
    const last = normalized[normalized.length - 1]
    if (first.lat === last.lat && first.lng === last.lng) normalized.pop()
  }
  if (normalized.length < 3) throw new Error('Boundary requires at least three valid points')
  return normalized
}

function pointsFromGeoJson(value) {
  if (Array.isArray(value) && Array.isArray(value[0])) {
    return normalizePoints(value.map(([lng, lat]) => ({ lat, lng })))
  }

  let geometry = value
  if (value?.type === 'FeatureCollection') {
    geometry = value.features?.find(feature => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type))?.geometry
  } else if (value?.type === 'Feature') {
    geometry = value.geometry
  }

  if (geometry?.type === 'Polygon') {
    return normalizePoints((geometry.coordinates?.[0] || []).map(([lng, lat]) => ({ lat, lng })))
  }
  if (geometry?.type === 'MultiPolygon') {
    return normalizePoints((geometry.coordinates?.[0]?.[0] || []).map(([lng, lat]) => ({ lat, lng })))
  }
  throw new Error('GeoJSON must contain a Polygon or MultiPolygon')
}

function pointsFromKml(text) {
  if (typeof DOMParser === 'undefined') throw new Error('KML parsing is unavailable in this environment')
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('Invalid KML document')
  const coordinateNode = document.querySelector('Polygon outerBoundaryIs LinearRing coordinates, Polygon coordinates')
  if (!coordinateNode?.textContent) throw new Error('KML must contain a Polygon boundary')
  const points = coordinateNode.textContent.trim().split(/\s+/).map(value => {
    const [lng, lat] = value.split(',').map(Number)
    return { lat, lng }
  })
  return normalizePoints(points)
}

function pointsFromCoordinateText(text) {
  const lines = text.split(/[\r\n;]+/).map(line => line.trim()).filter(Boolean)
  const points = lines.map(line => {
    const values = line.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []
    if (values.length < 2) return null
    return { lat: values[0], lng: values[1] }
  }).filter(Boolean)
  return normalizePoints(points)
}

export function parseParcelBoundary(text, fileName = '') {
  const value = String(text || '').trim()
  if (!value) throw new Error('Boundary data is empty')
  const lowerName = String(fileName).toLowerCase()

  if (lowerName.endsWith('.kml') || /^<\?xml|^<kml[\s>]/i.test(value)) {
    return { points: pointsFromKml(value), format: 'KML' }
  }

  if (lowerName.endsWith('.json') || lowerName.endsWith('.geojson') || /^[\[{]/.test(value)) {
    try {
      return { points: pointsFromGeoJson(JSON.parse(value)), format: 'GeoJSON' }
    } catch (error) {
      if (/GeoJSON|Boundary requires/.test(error.message)) throw error
      throw new Error('Invalid GeoJSON document')
    }
  }

  return { points: pointsFromCoordinateText(value), format: 'Coordinates' }
}

export function parcelBoundaryToGeoJson(points, properties = {}) {
  const normalized = normalizePoints(points)
  const ring = normalized.map(point => [point.lng, point.lat])
  ring.push([...ring[0]])
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

