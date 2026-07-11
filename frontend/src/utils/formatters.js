const PAYMENT_LABELS = { pix: 'Pix', cash: 'Dinheiro', credit_card: 'Cartão' }

const STATUS_LABELS = {
  pending: 'Novo',
  accepted: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivering: 'A caminho',
  completed: 'Entregue'
}

export function paymentLabel(method) {
  return PAYMENT_LABELS[method] || method
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status
}

export function formatAddress(addr) {
  if (!addr) return ''
  return `${addr.street}, ${addr.number} - ${addr.city}/${addr.state}`
}

export function formatCurrency(value) {
  return `R$ ${Number(value ?? 0).toFixed(2)}`
}

export function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`
}
