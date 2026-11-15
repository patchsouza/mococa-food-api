const API_URL = (import.meta.env.VITE_API_URL || 'https://perpetual-cooperation-development.up.railway.app').replace(/\/$/, '')

let authToken = typeof localStorage === 'undefined' ? null : localStorage.getItem('mococa-token')
let adminToken = typeof localStorage === 'undefined' ? null : localStorage.getItem('mococa-admin-token')

export function setAuthToken(token) {
  authToken = token
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('mococa-token', token)
    else localStorage.removeItem('mococa-token')
  }
}

export function setAdminAuthToken(token) {
  adminToken = token
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('mococa-admin-token', token)
    else localStorage.removeItem('mococa-admin-token')
  }
}

async function request(path, { method = 'GET', body, headers = {}, token = authToken } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

const api = (path, options) => request(`/api${path}`, options)
const adminApiRequest = (path, options = {}) => request(`/api/admin${path}`, { ...options, token: adminToken })

export const authApi = {
  login(credentials) {
    return api('/auth/login', { method: 'POST', body: credentials })
  },
  register(user) {
    return api('/auth/register', { method: 'POST', body: user })
  },
  me() {
    return api('/auth/me')
  }
}

export const adminApi = {
  login(credentials) {
    return adminApiRequest('/auth/login', { method: 'POST', body: credentials, token: null })
  },
  me() {
    return adminApiRequest('/me')
  },
  logout() {
    return adminApiRequest('/auth/logout', { method: 'POST' })
  },
  dashboard() {
    return adminApiRequest('/dashboard')
  }
}

export const restaurantApi = {
  list(params = {}) {
    const query = new URLSearchParams(params).toString()
    return api(`/restaurants${query ? `?${query}` : ''}`)
  },
  get(id) {
    return api(`/restaurants/${id}`)
  },
  mine() {
    return api('/restaurants/mine/all')
  },
  create(restaurant) {
    return api('/restaurants', { method: 'POST', body: restaurant })
  },
  update(id, fields) {
    return api(`/restaurants/${id}`, { method: 'PATCH', body: fields })
  },
  toggleOpen(id) {
    return api(`/restaurants/${id}/toggle-open`, { method: 'PATCH' })
  },
  dashboard(id) {
    return api(`/restaurants/${id}/dashboard`)
  },
  orders(id) {
    return api(`/restaurants/${id}/orders`)
  },
  addProduct(id, product) {
    return api(`/restaurants/${id}/products`, { method: 'POST', body: product })
  },
  updateProduct(id, productId, fields) {
    return api(`/restaurants/${id}/products/${productId}`, { method: 'PATCH', body: fields })
  },
  deleteProduct(id, productId) {
    return api(`/restaurants/${id}/products/${productId}`, { method: 'DELETE' })
  }
}

export const ordersApi = {
  create(order) {
    return api('/orders', { method: 'POST', body: order })
  },
  mine() {
    return api('/orders/mine')
  },
  get(id) {
    return api(`/orders/${id}`)
  },
  cancel(id, reason) {
    return api(`/orders/${id}/cancel`, { method: 'POST', body: { reason } })
  },
  updateStatus(id, nextStatus, note) {
    return api(`/orders/${id}/status`, { method: 'PATCH', body: { nextStatus, note } })
  }
}

export const courierApi = {
  dashboard() {
    return api('/deliveries/dashboard')
  },
  offers() {
    return api('/deliveries/offers')
  },
  setAvailability(isAvailable) {
    return api('/deliveries/availability', { method: 'POST', body: { isAvailable } })
  },
  updateLocation(lat, lng) {
    return api('/deliveries/location', { method: 'POST', body: { lat, lng } })
  },
  accept(orderId) {
    return api(`/deliveries/${orderId}/accept`, { method: 'POST' })
  },
  reject(orderId) {
    return api(`/deliveries/${orderId}/reject`, { method: 'POST' })
  },
  complete(orderId) {
    return api(`/deliveries/${orderId}/complete`, { method: 'POST' })
  }
}

export const healthApi = {
  check() {
    return request('/health')
  }
}

// ---- Rotas Pix ----

export const pixApi = {
  /** Cria uma transação Pix para um pedido existente. */
  createForOrder(orderId, { expiresInMinutes } = {}) {
    return api(`/orders/${orderId}/pix`, {
      method: 'POST',
      body: { expiresInMinutes }
    })
  },

  /** Consulta a transação Pix mais recente de um pedido (para polling de status). */
  getByOrder(orderId) {
    return api(`/orders/${orderId}/pix`)
  },

  /** Detalhes de uma transação por ID. */
  getById(transactionId) {
    return api(`/pix/${transactionId}`)
  },

  /** Cancela uma transação pendente. */
  cancel(transactionId, reason) {
    return api(`/pix/${transactionId}`, {
      method: 'DELETE',
      body: { reason }
    })
  }
}
