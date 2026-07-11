<template>
  <div class="view">
    <AppHeader :title="`Olá, ${auth.currentUser.name} 👋`" subtitle="O que vamos pedir?" show-logout @logout="auth.logout()" />

    <OrderTracker v-if="orders.myActiveOrder" :order="orders.myActiveOrder" @cancel="orders.cancel(orders.myActiveOrder.id)" />

    <div style="padding: 16px;">
      <h2 style="font-size: 1.2rem; margin-bottom: 12px;">Lojas em Mococa</h2>
      <EmptyState v-if="catalog.openRestaurants.length === 0" icon="fas fa-store-slash" message="Nenhuma loja aberta em Mococa agora." />
      <div v-for="r in catalog.openRestaurants" :key="r.id" class="card rest-card" @click="selectRestaurant(r)">
        <div class="rest-img">🍔</div>
        <div class="rest-info">
          <h3>{{ r.name }}</h3>
          <p>{{ r.category }} · mín. {{ formatCurrency(r.minOrderValue) }}</p>
          <p style="color:var(--success); font-weight:600;">Taxa: {{ formatCurrency(r.deliveryFee) }}</p>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--text-light); align-self:center;"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppHeader from '../layout/AppHeader.vue'
import EmptyState from '../layout/EmptyState.vue'
import OrderTracker from './OrderTracker.vue'
import { useAuthStore } from '../../stores/auth'
import { useCatalogStore } from '../../stores/catalog'
import { useCartStore } from '../../stores/cart'
import { useOrdersStore } from '../../stores/orders'
import { useNavigationStore } from '../../stores/navigation'
import { formatCurrency } from '../../utils/formatters'

const auth = useAuthStore()
const catalog = useCatalogStore()
const cart = useCartStore()
const orders = useOrdersStore()
const nav = useNavigationStore()

function selectRestaurant(restaurant) {
  cart.selectRestaurant(restaurant.id)
  nav.navigateTo('cliente-restaurant')
}
</script>
