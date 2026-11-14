import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useCatalogStore } from './catalog'
import { ordersApi, restaurantApi } from '../utils/api'

const ACTIVE_CUSTOMER_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'delivering']
const API_STATUSES = {
  confirmed: 'accepted',
  ready_for_pickup: 'ready',
  awaiting_courier: 'ready',
  in_delivery: 'delivering',
  delivered: 'completed',
  cancelled: 'canceled'
}

export function normalizeOrder(order) {
  return {
    ...order,
    id: order.id || order._id,
    customerId: order.customer?._id || order.customer,
    customerName: order.customer?.name || order.customerName || 'Cliente',
    restaurantId: order.restaurant?._id || order.restaurant,
    restaurantName: order.restaurant?.name || order.restaurantName || 'Loja',
    courierId: order.courier?._id || order.courier || null,
    courierName: order.courier?.name || order.courierName || null,
    status: API_STATUSES[order.status] || order.status,
    paymentMethod: { dinheiro: 'cash', cartao: 'credit_card' }[order.paymentMethod] || order.paymentMethod,
    items: (order.items || []).map((item) => ({
      ...item,
      id: item.id || item.product?._id || item.product,
      productId: item.product?._id || item.product,
      price: item.unitPrice ?? item.price,
      quantity: Number(item.quantity || 1)
    }))
  }
}

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    orders: [],
    stats: { ordersToday: 0, revenueToday: 0 },
    error: ''
  }),

  getters: {
    myActiveOrder(state) {
      const userId = useAuthStore().currentUser?.id
      return state.orders.find((o) => o.customerId === userId && ACTIVE_CUSTOMER_STATUSES.includes(o.status))
    },

    /** Orders belonging to the logged-in store owner that still need attention. */
    storeOrders(state) {
      const restaurantId = useCatalogStore().myRestaurant?.id
      return state.orders.filter(
        (o) => o.restaurantId === restaurantId && !['completed', 'rejected', 'canceled'].includes(o.status)
      )
    },

    /** Orders ready for pickup, not yet claimed by a courier. */
    availableDeliveries: (state) => state.orders.filter((o) => o.status === 'ready' && !o.courierId),

    restStatsToday(state) {
      const restaurantId = useCatalogStore().myRestaurant?.id
      return state.stats || { ordersToday: 0, revenueToday: 0 }
    },

    findById: (state) => (id) => state.orders.find((o) => o.id === id)
  },

  actions: {
    async loadMine() {
      this.error = ''
      try {
        this.orders = (await ordersApi.mine()).map(normalizeOrder)
      } catch (error) {
        this.error = error.message
      }
    },

    async refresh(orderId) {
      try {
        const order = normalizeOrder(await ordersApi.get(orderId))
        this.replaceOrder({ ...this.findById(orderId), ...order })
      } catch (error) {
        this.error = error.message
      }
    },

    async loadStoreOrders(restaurantId) {
      this.error = ''
      try {
        this.orders = (await restaurantApi.orders(restaurantId)).map(normalizeOrder)
      } catch (error) {
        this.error = error.message
      }
    },

    async loadDashboard(restaurantId) {
      this.error = ''
      try {
        const dashboard = await restaurantApi.dashboard(restaurantId)
        this.orders = dashboard.activeOrders.map(normalizeOrder)
        this.stats = {
          ordersToday: dashboard.ordersToday,
          revenueToday: dashboard.revenueToday,
          deliveredToday: dashboard.deliveredToday,
          cancelledToday: dashboard.cancelledToday
        }
      } catch (error) {
        this.error = error.message
      }
    },

    async create({ restaurantId, items, deliveryAddress, paymentMethod }) {
      this.error = ''
      try {
        const apiPaymentMethod = { cash: 'dinheiro', credit_card: 'cartao' }[paymentMethod] || paymentMethod
        const order = await ordersApi.create({
          restaurantId,
          items: items.map((item) => ({ productId: item.productId || item.id || item._id, quantity: item.quantity })),
          deliveryAddress,
          paymentMethod: apiPaymentMethod
        })
        const normalized = normalizeOrder(order)
        this.orders.unshift(normalized)
        return normalized
      } catch (error) {
        this.error = error.message
        return null
      }
    },

    async cancel(orderId, reason = 'Cancelado pelo cliente') {
      this.error = ''
      try {
        const order = normalizeOrder(await ordersApi.cancel(orderId, reason))
        this.replaceOrder(order)
      } catch (error) {
        this.error = error.message
      }
    },

    async updateStatus(orderId, status) {
      this.error = ''
      try {
        if (status === 'rejected' || status === 'canceled') {
          const order = normalizeOrder(await ordersApi.cancel(orderId, 'Recusado pela loja'))
          this.replaceOrder({ ...this.findById(orderId), ...order, status: 'canceled' })
          return
        }
        const nextStatus = { accepted: 'confirmed', ready: 'ready_for_pickup' }[status] || status
        const result = await ordersApi.updateStatus(orderId, nextStatus)
        this.replaceOrder({ ...this.findById(orderId), ...normalizeOrder(result) })
      } catch (error) {
        this.error = error.message
      }
    },

    replaceOrder(order) {
      const index = this.orders.findIndex((item) => item.id === order.id)
      if (index === -1) this.orders.unshift(order)
      else this.orders[index] = order
    }
  }
})
