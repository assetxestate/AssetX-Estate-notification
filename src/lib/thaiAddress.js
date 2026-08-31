import rawAddressDb from 'thai-address-database/database/db.json'

function expandThaiAddressDb(rawDb) {
  const expanded = []
  const lookup = rawDb.lookup ? rawDb.lookup.split('|') : []
  const words = rawDb.words ? rawDb.words.split('|') : []
  const source = rawDb.data || rawDb
  const useLookup = Boolean(rawDb.lookup && rawDb.words)

  const unpackText = (value) => {
    let text = value
    if (useLookup && typeof text === 'number') text = lookup[text]
    text = String(text || '')
    if (!useLookup) return text
    return text.replace(/[A-Z]/ig, (match) => {
      const code = match.charCodeAt(0)
      return words[code < 97 ? code - 65 : 26 + code - 97] || match
    })
  }

  source.forEach((provinceRow) => {
    const childIndex = provinceRow.length === 3 ? 2 : 1
    const province = unpackText(provinceRow[0])
    ;(provinceRow[childIndex] || []).forEach((amphoeRow) => {
      const amphoe = unpackText(amphoeRow[0])
      ;(amphoeRow[childIndex] || []).forEach((districtRow) => {
        const district = unpackText(districtRow[0])
        expanded.push({ province, amphoe, district })
      })
    })
  })

  return expanded
}

function uniqueThai(values) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'th'))
}

const ADDRESS_ROWS = expandThaiAddressDb(rawAddressDb)

export const ADDRESS_PROVINCES = uniqueThai(ADDRESS_ROWS.map(row => row.province))

export function getDistrictsByProvince(province) {
  return uniqueThai(
    ADDRESS_ROWS
      .filter(row => row.province === province)
      .map(row => row.amphoe)
  )
}

export function getSubdistrictsByDistrict(province, district) {
  return uniqueThai(
    ADDRESS_ROWS
      .filter(row => row.province === province && row.amphoe === district)
      .map(row => row.district)
  )
}
