import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { seedRestaurants, seedMenuItems } from '../data/seed'
import { randomId } from '../utils/formatters'

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    restaurants: structuredClone(seedRestaurants),
    menuItems: structuredClone(seedMenuItems)
  }),

  getters: {
    openRestaurants: (state) => state.restaurants.filter((r) => r.isOpen),

    /** The restaurant owned by the currently logged-in "loja" user, if any. */
    myRestaurant(state) {
      const restaurantId = useAuthStore().currentUser?.restaurantId
      return state.restaurants.find((r) => r.id === restaurantId) ?? null
    },

    myMenu(state) {
      const mine = this.myRestaurant
      if (!mine) return []
      return state.menuItems.filter((m) => m.restaurantId === mine.id)
    },

    getRestaurantName: (state) => (id) => {
      return state.restaurants.find((r) => r.id === id)?.name ?? 'Loja'
    },

    menuCategoriesFor: (state) => (restaurantId) => {
      const items = state.menuItems.filter((m) => m.restaurantId === restaurantId)
      return [...new Set(items.map((i) => i.category))]
    },

    getMenuByCategory: (state) => (restaurantId, category) => {
      return state.menuItems.filter((m) => m.restaurantId === restaurantId && m.category === category)
    }
  },

  actions: {
    createRestaurant({ name, category, address }) {
      const restaurant = {
        id: randomId('r'),
        name,
        category,
        address,
        minOrderValue: 20,
        deliveryFee: 5.00,
        isOpen: true,
        description: 'Uma nova loja em Mococa!'
      }
      this.restaurants.push(restaurant)
      useAuthStore().assignRestaurant(restaurant.id)
      return restaurant
    },

    toggleMyStoreStatus() {
      if (this.myRestaurant) this.myRestaurant.isOpen = !this.myRestaurant.isOpen
    },

    addMenuItem({ name, category, price }) {
      if (!this.myRestaurant || !name || !price) return
      this.menuItems.push({
        id: randomId('m'),
        restaurantId: this.myRestaurant.id,
        name,
        category: category || 'Geral',
        price: Number(price),
        description: ''
      })
    },

    removeMenuItem(id) {
      this.menuItems = this.menuItems.filter((m) => m.id !== id)
    }
  }
})
