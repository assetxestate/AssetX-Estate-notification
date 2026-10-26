async function lineAction(action, recipientId, message) {
  const response = await fetch(`/api/line-webhook?action=${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientId, message }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `ส่ง LINE ไม่สำเร็จ (HTTP ${response.status})`);
  return result;
}

export function sendLineMessage(recipientId, message) {
  return lineAction('send', recipientId, message);
}

export function checkLineConnection(recipientId) {
  return lineAction('check', recipientId);
}
