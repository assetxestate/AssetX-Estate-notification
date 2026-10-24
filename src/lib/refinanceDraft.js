export const REFINANCE_DRAFT_KEY = 'assetx.refinance.draft.v1'

export function readRefinanceDraft(storage, defaults) {
  const fallback = { form: { ...defaults }, payoffMode: 'calculated' }
  try {
    const saved = JSON.parse(storage.getItem(REFINANCE_DRAFT_KEY))
    if (saved?.version !== 1 || !saved.form || typeof saved.form !== 'object') return fallback
    for (const key of Object.keys(defaults)) {
      if (typeof saved.form[key] === 'string') fallback.form[key] = saved.form[key]
    }
    fallback.payoffMode = saved.payoffMode === 'manual' ? 'manual' : 'calculated'
  } catch { /* Missing or unavailable storage must not block the calculator. */ }
  return fallback
}

export function saveRefinanceDraft(storage, form, payoffMode) {
  try {
    storage.setItem(REFINANCE_DRAFT_KEY, JSON.stringify({ version: 1, form, payoffMode }))
    return true
  } catch {
    return false
  }
}
