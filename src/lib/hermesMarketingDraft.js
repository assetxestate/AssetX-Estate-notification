const MAX_IMAGE = 4 * 1024 * 1024

export function validateHermesDraft(value) {
  if (value?.version !== 1 || !/^[a-f0-9]{32}$/.test(value.id || '')) throw new Error('Invalid draft identity')
  for (const [key, limit] of [['title', 160], ['caption', 2400], ['imagePrompt', 4000]]) {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > limit) throw new Error(`Invalid ${key}`)
  }
  if (!Array.isArray(value.sources) || !value.sources.length || value.sources.length > 8) throw new Error('Approved sources required')
  const sources = value.sources.map((source) => {
    if (typeof source.file !== 'string' || !source.file.endsWith('.md') || !/^[a-f0-9]{64}$/.test(source.sha256 || '')) throw new Error('Invalid source')
    return { file: source.file, sha256: source.sha256 }
  })
  if (typeof value.image !== 'string' || value.image.length > MAX_IMAGE || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.image)) throw new Error('A valid image under 3MB is required')
  // Explicit projection prevents an agent-supplied approval or Facebook ID being imported.
  return { version: 1, id: value.id, title: value.title.trim(), caption: value.caption.trim(), imagePrompt: value.imagePrompt.trim(), sources, image: value.image }
}

export function importHermesDraft(workspace, input) {
  const draft = validateHermesDraft(input)
  const id = `hermes-${draft.id}`
  if ((workspace.posts || []).some((post) => post.id === id) || (workspace.hiddenPostIds || []).includes(id)) return workspace
  const mediaAssetId = `asset-${id}`
  return {
    ...workspace,
    posts: [{ id, title: draft.title, caption: draft.caption, imagePrompt: draft.imagePrompt,
      channel: 'Facebook', status: 'pending', reviewStatus: 'needs_edit',
      reviewNotes: ['ร่างจาก Hermes ต้องตรวจเนื้อหาและภาพก่อนอนุมัติ'],
      knowledgeSources: draft.sources, source: 'Hermes / Telegram', mediaAssetId,
    }, ...(workspace.posts || [])],
    mediaAssets: [{ id: mediaAssetId, postId: id, briefId: id, title: draft.title, dataUrl: draft.image,
      source: 'Hermes draft', originalName: 'hermes-artwork', createdAt: new Date().toISOString(),
    }, ...(workspace.mediaAssets || [])],
  }
}
