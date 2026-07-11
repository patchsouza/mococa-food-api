import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useCatalogStore } from './catalog'
import { randomId } from '../utils/formatters'

const ACTIVE_CUSTOMER_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'delivering']

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    orders: []
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
      const completedToday = state.orders.filter((o) => o.restaurantId === restaurantId && o.status === 'completed')
      return {
        ordersToday: completedToday.length,
        revenueToday: completedToday.reduce((sum, o) => sum + o.total, 0)
      }
    },

    findById: (state) => (id) => state.orders.find((o) => o.id === id)
  },

  actions: {
    create({ restaurantId, items, total, deliveryFee, paymentMethod, deliveryAddress }) {
      const auth = useAuthStore()
      const order = {
        id: randomId('ord'),
        customerId: auth.currentUser.id,
        customerName: auth.currentUser.name,
        restaurantId,
        items,
        total,
        deliveryFee,
        paymentMethod,
        deliveryAddress,
        status: 'pending',
        courierId: null,
        courierName: null,
        createdAt: new Date()
      }
      this.orders.push(order)
      return order
    },

    cancel(orderId) {
      this.updateStatus(orderId, 'canceled')
    },

    updateStatus(orderId, status) {
      const order = this.findById(orderId)
      if (order) order.status = status
    },

    assignCourier(orderId, courier) {
      const order = this.findById(orderId)
      if (!order) return
      order.status = 'delivering'
      order.courierId = courier.id
      order.courierName = courier.name
    },

    completeDelivery(orderId) {
      this.updateStatus(orderId, 'completed')
    }
  }
})
