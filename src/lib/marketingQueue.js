export function canRecoverManualFacebookPost(post = {}) {
  return /facebook/i.test(String(post.channel || '')) &&
    post.status === 'posted' && !post.facebookPostId
}

export function recoverManualFacebookPost(post) {
  if (!canRecoverManualFacebookPost(post)) return null
  return {
    status: 'approved',
    postedAt: '',
    scheduledAt: '',
    facebookScheduledAt: '',
    publishError: '',
  }
}
