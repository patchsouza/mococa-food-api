import { defineStore } from 'pinia'
import { courierApi } from '../utils/api'
import { normalizeOrder } from './orders'

export const useCourierStore = defineStore('courier', {
  state: () => ({
    available: false,
    balance: 0,
    rating: 4.8,
    radiusKm: 5,
    activeDelivery: null,
    offers: [],
    error: ''
  }),

  getters: {
    availableDeliveries: (state) => state.offers
  },

  actions: {
    async loadDashboard() {
      this.error = ''
      try {
        const data = await courierApi.dashboard()
        this.available = data.courier.isAvailable
        this.balance = data.courier.balance || 0
        this.rating = data.courier.rating || 0
        this.activeDelivery = data.activeDeliveries[0] ? normalizeOrder(data.activeDeliveries[0]) : null
      } catch (error) {
        this.error = error.message
      }
    },

    async loadOffers() {
      this.error = ''
      try {
        this.offers = (await courierApi.offers()).map(normalizeOrder)
      } catch (error) {
        this.error = error.message
      }
    },

    async setAvailable(value) {
      this.error = ''
      try {
        if (value) {
          if (!navigator.geolocation) throw new Error('Este navegador não oferece acesso à localização.')
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Permita o acesso à localização para receber corridas.')))
          })
          await courierApi.updateLocation(position.coords.latitude, position.coords.longitude)
        }
        const result = await courierApi.setAvailability(value)
        this.available = result.isAvailable
        if (this.available) await this.loadOffers()
      } catch (error) {
        this.error = error.message
      }
    },

    async acceptDelivery(order) {
      this.error = ''
      try {
        this.activeDelivery = normalizeOrder(await courierApi.accept(order.id))
        this.available = false
        this.offers = this.offers.filter((offer) => offer.id !== order.id)
      } catch (error) {
        this.error = error.message
        await this.loadOffers()
      }
    },

    async rejectDelivery(orderId) {
      this.error = ''
      try {
        await courierApi.reject(orderId)
        this.offers = this.offers.filter((offer) => offer.id !== orderId)
      } catch (error) {
        this.error = error.message
      }
    },

    async confirmDelivery() {
      if (!this.activeDelivery) return
      this.error = ''
      try {
        await courierApi.complete(this.activeDelivery.id)
        this.activeDelivery = null
        await this.loadDashboard()
      } catch (error) {
        this.error = error.message
      }
    },

    reset() {
      this.activeDelivery = null
      this.offers = []
    }
  }
})
