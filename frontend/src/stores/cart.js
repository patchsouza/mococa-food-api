import { defineStore } from 'pinia'
import { useCatalogStore } from './catalog'

export const useCartStore = defineStore('cart', {
  state: () => ({
    selectedRestaurantId: null,
    items: []
  }),

  getters: {
    selectedRestaurant(state) {
      if (!state.selectedRestaurantId) return null
      return useCatalogStore().restaurants.find((r) => r.id === state.selectedRestaurantId) ?? null
    },

    qty: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),

    subtotal: (state) => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),

    total() {
      return this.subtotal + (this.selectedRestaurant?.deliveryFee ?? 0)
    },

    meetsMinimum() {
      if (!this.selectedRestaurant) return false
      return this.subtotal >= this.selectedRestaurant.minOrderValue
    }
  },

  actions: {
    selectRestaurant(restaurantId) {
      this.selectedRestaurantId = restaurantId
      this.items = []
    },

    addItem(product) {
      const existing = this.items.find((i) => i.id === product.id)
      if (existing) existing.quantity++
      else this.items.push({ ...product, quantity: 1 })
    },

    updateQty(itemId, delta) {
      const item = this.items.find((i) => i.id === itemId)
      if (!item) return
      item.quantity += delta
      if (item.quantity <= 0) this.items = this.items.filter((i) => i.id !== itemId)
    },

    clear() {
      this.items = []
    }
  }
})
