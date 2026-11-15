import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixPayload } from '../src/utils/pixPayload.js';

function decodeFields(payload) {
  const fields = [];
  let offset = 0;
  while (offset < payload.length) {
    const id = payload.slice(offset, offset + 2);
    const length = Number(payload.slice(offset + 2, offset + 4));
    const value = payload.slice(offset + 4, offset + 4 + length);
    assert.equal(value.length, length, `campo EMV ${id} truncado`);
    fields.push({ id, value });
    offset += 4 + length;
  }
  return fields;
}

function calculateCRC16(payload) {
  let crc = 0xFFFF;
  for (const character of payload) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

test('Pix payload retains the complete amount, merchant key, and valid CRC', () => {
  const payload = createPixPayload({
    beneficiaryName: 'Café Mococa',
    beneficiaryKey: 'financeiro@mococa.example',
    beneficiaryKeyType: 'email',
    beneficiaryCity: 'Mococa',
    amount: 45.9,
    transactionId: 'TXN-123456'
  });
  const fields = decodeFields(payload.slice(0, -8));
  const fieldsById = Object.fromEntries(fields.map(({ id, value }) => [id, value]));
  const merchant = Object.fromEntries(decodeFields(fieldsById['26']).map(({ id, value }) => [id, value]));
  const additional = Object.fromEntries(decodeFields(fieldsById['62']).map(({ id, value }) => [id, value]));

  assert.equal(fieldsById['54'], '45.90');
  assert.equal(fieldsById['59'], 'CAFE MOCOCA');
  assert.equal(merchant['00'], 'BR.GOV.BCB.PIX');
  assert.equal(merchant['01'], 'financeiro@mococa.example');
  assert.equal(additional['05'], 'TXN-123456');
  assert.equal(payload.slice(-8, -4), '6304');
  assert.equal(payload.slice(-4), calculateCRC16(payload.slice(0, -4)));
});

test('Pix payload rejects invalid keys and overlong merchant fields', () => {
  const base = {
    beneficiaryName: 'Mococa Food',
    beneficiaryKey: 'pix@example.com',
    beneficiaryKeyType: 'email',
    beneficiaryCity: 'Mococa',
    amount: 10
  };

  assert.throws(() => createPixPayload({ ...base, beneficiaryKeyType: 'unknown' }), /Tipo de chave Pix inválido/);
  assert.throws(() => createPixPayload({ ...base, beneficiaryName: 'Nome comercial longo demais para o Pix' }), /Nome do beneficiário/);
});