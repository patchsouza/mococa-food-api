import { defineStore } from 'pinia'
import { useNavigationStore } from './navigation'
import { useCatalogStore } from './catalog'
import { useCartStore } from './cart'
import { useCourierStore } from './courier'
import { authApi, restaurantApi, setAuthToken } from '../utils/api'

const ROLE_TO_VIEW = {
  customer: 'cliente-home',
  restaurant_owner: 'loja-dashboard',
  courier: 'moto-dashboard'
}

const ROLE_TO_UI = {
  customer: 'cliente',
  restaurant_owner: 'loja',
  courier: 'moto'
}

function normalizeUser(user) {
  return { ...user, id: user.id || user._id, role: ROLE_TO_UI[user.role] || user.role, apiRole: user.role }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: null,
    error: '',
    loading: false
  }),

  actions: {
    async login(credentials) {
      this.error = ''
      this.loading = true
      try {
        const result = await authApi.login(credentials)
        setAuthToken(result.token)
        await this.startSession(result.user)
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    async register({ name, email, password, phone, role }) {
      this.error = ''
      this.loading = true
      try {
        const apiRole = { cliente: 'customer', loja: 'restaurant_owner', moto: 'courier' }[role] || 'customer'
        const result = await authApi.register({ name, email, password, phone, role: apiRole })
        setAuthToken(result.token)
        await this.startSession(result.user)
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    async restoreSession() {
      if (typeof localStorage === 'undefined' || !localStorage.getItem('mococa-token')) return
      try {
        const user = await authApi.me()
        await this.startSession(user)
      } catch {
        setAuthToken(null)
      }
    },

    async startSession(user) {
      this.currentUser = normalizeUser(user)
      const nav = useNavigationStore()
      if (user.role === 'restaurant_owner') {
        const restaurants = await restaurantApi.mine()
        const mine = restaurants[0]
        if (mine) {
          const catalog = useCatalogStore()
          const restaurant = catalog.setMyRestaurant(mine)
          this.currentUser.restaurantId = restaurant.id
          await catalog.loadRestaurant(restaurant.id)
          nav.reset('loja-dashboard')
          return
        }
        nav.reset('loja-setup')
        return
      }
      nav.reset(ROLE_TO_VIEW[user.role] || 'cliente-home')
    },

    /** Called by the catalog store once a new store owner finishes onboarding. */
    assignRestaurant(restaurantId) {
      if (this.currentUser) this.currentUser.restaurantId = restaurantId
    },

    logout() {
      this.currentUser = null
      this.error = ''
      setAuthToken(null)
      useCartStore().clear()
      useCourierStore().reset()
      useNavigationStore().reset('login')
    }
  }
})
