/**
 * Cliente HTTP mínimo para a API do Mococa Food (backend Fastify).
 *
 * ⚠️ Importante: o frontend atual é 100% mockado (stores Pinia com dados locais,
 * sem chamadas de rede). Este módulo é o primeiro passo da integração real:
 * concentra as chamadas de Pix em um lugar só. Quando o auth real for ligado,
 * basta fornecer o token via setAuthToken().
 */

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'

let authToken = null

export function setAuthToken(token) {
  authToken = token
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const error = new Error(data?.error || `Erro HTTP ${res.status}`)
    error.status = res.status
    error.details = data?.details
    throw error
  }

  return data
}

// ---- Rotas Pix ----

export const pixApi = {
  /** Cria uma transação Pix para um pedido existente. */
  createForOrder(orderId, { expiresInMinutes } = {}) {
    return request(`/orders/${orderId}/pix`, {
      method: 'POST',
      body: { expiresInMinutes }
    })
  },

  /** Consulta a transação Pix mais recente de um pedido (para polling de status). */
  getByOrder(orderId) {
    return request(`/orders/${orderId}/pix`)
  },

  /** Detalhes de uma transação por ID. */
  getById(transactionId) {
    return request(`/pix/${transactionId}`)
  },

  /** Cancela uma transação pendente. */
  cancel(transactionId, reason) {
    return request(`/pix/${transactionId}`, {
      method: 'DELETE',
      body: { reason }
    })
  }
}
