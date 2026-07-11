import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useOrdersStore } from './orders'

/**
 * Deterministic stand-in for a real routing-engine distance.
 * Hashing the order id (instead of calling Math.random() on every render,
 * like the original prototype did) keeps the number stable across re-renders.
 */
function fakeDistanceKm(orderId) {
  let hash = 0
  for (const char of orderId) hash = (hash * 31 + char.charCodeAt(0)) % 1000
  return 1 + (hash / 1000) * 3 // 1km – 4km
}

export const useCourierStore = defineStore('courier', {
  state: () => ({
    available: false,
    balance: 0,
    rating: 4.8,
    radiusKm: 5,
    activeDeliveryId: null
  }),

  getters: {
    activeDelivery(state) {
      if (!state.activeDeliveryId) return null
      return useOrdersStore().findById(state.activeDeliveryId) ?? null
    },

    availableDeliveries() {
      return useOrdersStore().availableDeliveries
    }
  },

  actions: {
    setAvailable(value) {
      this.available = value
    },

    offerDistance(order) {
      return fakeDistanceKm(order.id)
    },

    acceptDelivery(order) {
      const courier = useAuthStore().currentUser
      useOrdersStore().assignCourier(order.id, courier)
      this.activeDeliveryId = order.id
    },

    rejectDelivery(_orderId) {
      // No-op for now: in a real backend this would put the offer back in the
      // dispatch pool / mark it as declined by this courier.
    },

    confirmDelivery() {
      if (!this.activeDeliveryId) return
      const order = this.activeDelivery
      useOrdersStore().completeDelivery(this.activeDeliveryId)
      if (order) this.balance += order.deliveryFee
      this.activeDeliveryId = null
    },

    reset() {
      this.activeDeliveryId = null
    }
  }
})
