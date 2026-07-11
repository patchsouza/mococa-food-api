import { defineStore } from 'pinia'
import { useNavigationStore } from './navigation'
import { useCatalogStore } from './catalog'
import { useCartStore } from './cart'
import { useCourierStore } from './courier'

const MOCK_USERS = {
  cliente: { id: 'u1', name: 'João Cliente', role: 'cliente' },
  loja: { id: 'u2', name: 'Maria Dona', role: 'loja' },
  moto: { id: 'u3', name: 'Pedro Moto', role: 'moto' }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: null
  }),

  actions: {
    /** Real form submit — kept mocked here since there's no backend wired up yet. */
    login() {
      this.currentUser = { ...MOCK_USERS.cliente }
      useNavigationStore().reset('cliente-home')
    },

    quickLogin(role) {
      const nav = useNavigationStore()

      if (role === 'loja') {
        const catalog = useCatalogStore()
        const firstRestaurant = catalog.restaurants[0]
        this.currentUser = { ...MOCK_USERS.loja, restaurantId: firstRestaurant?.id ?? null }
        nav.reset('loja-dashboard')
        return
      }

      if (role === 'moto') {
        this.currentUser = { ...MOCK_USERS.moto }
        nav.reset('moto-dashboard')
        return
      }

      this.currentUser = { ...MOCK_USERS.cliente }
      nav.reset('cliente-home')
    },

    register({ name, role }) {
      this.currentUser = { id: 'u_new', name, role, restaurantId: null }
      const nav = useNavigationStore()

      if (role === 'loja') nav.reset('loja-setup')
      else if (role === 'moto') nav.reset('moto-dashboard')
      else nav.reset('cliente-home')
    },

    /** Called by the catalog store once a new store owner finishes onboarding. */
    assignRestaurant(restaurantId) {
      if (this.currentUser) this.currentUser.restaurantId = restaurantId
    },

    logout() {
      this.currentUser = null
      useCartStore().clear()
      useCourierStore().reset()
      useNavigationStore().reset('login')
    }
  }
})
