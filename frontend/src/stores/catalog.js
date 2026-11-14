import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { restaurantApi } from '../utils/api'

const normalizeRestaurant = (restaurant) => ({
  ...restaurant,
  id: restaurant.id || restaurant._id,
  address: restaurant.address || {}
})

const normalizeProduct = (product, restaurantId) => ({
  ...product,
  id: product.id || product._id,
  restaurantId: restaurantId || product.restaurantId || product.restaurant?._id || product.restaurant,
  price: Number(product.price)
})

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    restaurants: [],
    menuItems: [],
    error: ''
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
    async loadRestaurants() {
      this.error = ''
      try {
        this.restaurants = (await restaurantApi.list()).map(normalizeRestaurant)
      } catch (error) {
        this.error = error.message
      }
    },

    async loadRestaurant(id) {
      this.error = ''
      try {
        const data = await restaurantApi.get(id)
        const restaurant = normalizeRestaurant(data)
        const index = this.restaurants.findIndex((item) => item.id === restaurant.id)
        if (index === -1) this.restaurants.push(restaurant)
        else this.restaurants[index] = restaurant
        this.menuItems = this.menuItems.filter((item) => item.restaurantId !== restaurant.id)
        this.menuItems.push(...(data.menu || []).map((product) => normalizeProduct(product, restaurant.id)))
        return restaurant
      } catch (error) {
        this.error = error.message
        return null
      }
    },

    setMyRestaurant(data) {
      const restaurant = normalizeRestaurant(data)
      const index = this.restaurants.findIndex((item) => item.id === restaurant.id)
      if (index === -1) this.restaurants.push(restaurant)
      else this.restaurants[index] = restaurant
      return restaurant
    },

    async createRestaurant(fields) {
      this.error = ''
      try {
        const restaurant = this.setMyRestaurant(await restaurantApi.create(fields))
        useAuthStore().assignRestaurant(restaurant.id)
        return restaurant
      } catch (error) {
        this.error = error.message
        return null
      }
    },

    async toggleMyStoreStatus() {
      if (!this.myRestaurant) return
      this.error = ''
      try {
        const result = await restaurantApi.toggleOpen(this.myRestaurant.id)
        this.myRestaurant.isOpen = result.isOpen
      } catch (error) {
        this.error = error.message
      }
    },

    async addMenuItem({ name, category, price }) {
      if (!this.myRestaurant || !name || !price) return
      this.error = ''
      try {
        const product = await restaurantApi.addProduct(this.myRestaurant.id, { name, category, price: Number(price) })
        this.menuItems.push(normalizeProduct(product, this.myRestaurant.id))
        return true
      } catch (error) {
        this.error = error.message
        return false
      }
    },

    async removeMenuItem(id) {
      if (!this.myRestaurant) return
      this.error = ''
      try {
        await restaurantApi.deleteProduct(this.myRestaurant.id, id)
        this.menuItems = this.menuItems.filter((item) => item.id !== id)
      } catch (error) {
        this.error = error.message
      }
    }
  }
})
