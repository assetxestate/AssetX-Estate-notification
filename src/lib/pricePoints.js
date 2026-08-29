export function haversineDistanceMeters(aLat, aLng, bLat, bLng) {
  const lat1 = Number(aLat)
  const lng1 = Number(aLng)
  const lat2 = Number(bLat)
  const lng2 = Number(bLng)
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null

  const toRad = (deg) => (deg * Math.PI) / 180
  const earthRadiusMeters = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const rLat1 = toRad(lat1)
  const rLat2 = toRad(lat2)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h))
}

export function confidenceBand(score) {
  const n = Number(score) || 0
  if (n >= 80) return { label: "High", color: "#10B981" }
  if (n >= 50) return { label: "Medium", color: "#F59E0B" }
  return { label: "Low", color: "#EF4444" }
}

export function estimatePointConfidence({ hasCoordinates, hasOfficialPrice, nearbyCount, verifiedCount }) {
  let score = 20
  if (hasCoordinates) score += 25
  if (hasOfficialPrice) score += 20
  score += Math.min(20, nearbyCount * 5)
  score += Math.min(15, verifiedCount * 5)
  return Math.min(100, score)
}
