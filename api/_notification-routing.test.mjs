import assert from 'node:assert/strict';
import { getNotificationMode, resolveAutomaticRecipient } from './_notification-routing.js';

const reviewer = 'U_REVIEWER';
const customer = 'U_CUSTOMER';

assert.equal(getNotificationMode({}), 'review');
assert.equal(
  resolveAutomaticRecipient(customer, { LINE_REVIEW_USER_ID: reviewer }),
  reviewer,
);
assert.equal(
  resolveAutomaticRecipient(customer, {
    LINE_NOTIFICATION_MODE: 'review',
    LINE_REVIEW_USER_ID: reviewer,
  }),
  reviewer,
);
assert.equal(
  resolveAutomaticRecipient(customer, { LINE_NOTIFICATION_MODE: 'direct' }),
  customer,
);
assert.equal(
  resolveAutomaticRecipient('', { LINE_NOTIFICATION_MODE: 'direct' }),
  '',
);
assert.throws(
  () => resolveAutomaticRecipient(customer, { LINE_NOTIFICATION_MODE: 'review' }),
  /LINE_REVIEW_USER_ID/,
);
assert.throws(
  () => getNotificationMode({ LINE_NOTIFICATION_MODE: 'unknown' }),
  /review หรือ direct/,
);

console.log('notification routing tests passed');
