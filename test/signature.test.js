import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWebhookSignature, verifyWebhookSignature } from '../src/utils/signature.js';

test('webhook signature verifies the exact raw body', () => {
  const rawBody = '{"transactionId":"txn-1","status":"paid","amount":25.5}';
  const secret = 'test-secret';
  const signature = computeWebhookSignature(rawBody, secret);

  assert.equal(verifyWebhookSignature(rawBody, `sha256=${signature}`, secret), true);
  assert.equal(verifyWebhookSignature(`${rawBody} `, signature, secret), false);
  assert.equal(verifyWebhookSignature(rawBody, 'invalid', secret), false);
});