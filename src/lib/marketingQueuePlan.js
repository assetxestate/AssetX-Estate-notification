const actionableStates = ['approved', 'scheduled']

export function getMarketingQueueState(post, now = new Date()) {
  if (post.status === 'posted') return 'posted'
  if (!actionableStates.includes(post.status)) return 'other'
  if (/facebook/i.test(String(post.channel || '')) && post.facebookPostId) return 'platformScheduled'

  const date = post.scheduledAt ? new Date(post.scheduledAt) : null
  if (!date || Number.isNaN(date.getTime())) return 'unscheduled'

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (date < today) return 'overdue'
  if (date < tomorrow) return 'today'
  return 'upcoming'
}

export function organizeMarketingQueue(posts, now = new Date()) {
  const groups = { action: [], platformScheduled: [], posted: [] }
  for (const post of posts) {
    const queueState = getMarketingQueueState(post, now)
    if (queueState === 'other') continue
    const group = queueState === 'posted' ? 'posted' : queueState === 'platformScheduled' ? 'platformScheduled' : 'action'
    groups[group].push({ post, queueState })
  }

  const priority = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3 }
  groups.action.sort((a, b) => {
    const difference = priority[a.queueState] - priority[b.queueState]
    return difference || String(a.post.scheduledAt || '').localeCompare(String(b.post.scheduledAt || ''))
  })
  groups.platformScheduled.sort((a, b) => String(a.post.scheduledAt || '').localeCompare(String(b.post.scheduledAt || '')))
  groups.posted.sort((a, b) => String(b.post.postedAt || '').localeCompare(String(a.post.postedAt || '')))
  return groups
}
