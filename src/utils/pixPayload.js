import { BadRequest } from './errors.js';

function crc16(payload) {
  let crc = 0xFFFF;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function createPixPayload({
  beneficiaryName,
  beneficiaryKey,
  beneficiaryKeyType,
  beneficiaryCity,
  amount,
  transactionId,
  description
}) {
  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const field = (id, value) => {
    const text = String(value);
    const byteLength = Buffer.byteLength(text, 'utf8');
    if (byteLength > 99) throw BadRequest(`Campo Pix ${id} excede o limite EMV`);
    return `${id}${String(byteLength).padStart(2, '0')}${text}`;
  };

  const name = normalizeText(beneficiaryName);
  const city = normalizeText(beneficiaryCity);
  const key = String(beneficiaryKey || '').trim();
  const keyTypes = ['cpf', 'cnpj', 'phone', 'email', 'random'];
  if (!keyTypes.includes(String(beneficiaryKeyType).toLowerCase())) throw BadRequest('Tipo de chave Pix inválido');
  if (!name || name.length > 25) throw BadRequest('Nome do beneficiário deve ter até 25 caracteres');
  if (!city || city.length > 15) throw BadRequest('Cidade do beneficiário deve ter até 15 caracteres');
  if (!key || !/^[\x20-\x7E]+$/.test(key) || Buffer.byteLength(key, 'utf8') > 77) throw BadRequest('Chave Pix inválida');
  if (!Number.isFinite(amount) || amount <= 0) throw BadRequest('Valor da transação deve ser maior que zero');

  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', key) + (description ? field('02', normalizeText(description).slice(0, 72)) : '');
  const additionalData = field('05', String(transactionId || '***').slice(0, 25));
  const fields = [
    field('00', '01'),
    field('01', '11'),
    field('26', merchantAccount),
    field('52', '5812'),
    field('53', '986'),
    field('54', (Math.round(amount * 100) / 100).toFixed(2)),
    field('58', 'BR'),
    field('59', name),
    field('60', city),
    field('62', additionalData)
  ];
  const payload = `${fields.join('')}6304`;
  return `${payload}${crc16(payload)}`;
}