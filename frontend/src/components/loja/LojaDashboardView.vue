<template>
  <div class="view">
    <AppHeader :title="catalog.myRestaurant.name" subtitle="Painel da loja" show-logout @logout="auth.logout()">
      <template #actions>
        <button
          class="btn btn-sm"
          :class="catalog.myRestaurant.isOpen ? 'btn-success' : 'btn-danger'"
          style="width:auto; margin-right:8px;"
          @click="catalog.toggleMyStoreStatus()"
        >
          {{ catalog.myRestaurant.isOpen ? 'Aberta' : 'Fechada' }}
        </button>
      </template>
    </AppHeader>

    <div style="padding: 16px;">
      <div class="stats-grid">
        <div class="stat-card">
          <h4>Hoje</h4>
          <p>{{ orders.restStatsToday.ordersToday }} pedidos</p>
        </div>
        <div class="stat-card">
          <h4>Faturado</h4>
          <p>{{ formatCurrency(orders.restStatsToday.revenueToday) }}</p>
        </div>
      </div>

      <div class="tabs">
        <div class="tab" :class="{ active: tab === 'pedidos' }" @click="tab = 'pedidos'">Pedidos</div>
        <div class="tab" :class="{ active: tab === 'cardapio' }" @click="tab = 'cardapio'">Cardápio</div>
      </div>

      <LojaOrdersTab v-if="tab === 'pedidos'" />
      <LojaMenuTab v-if="tab === 'cardapio'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import LojaOrdersTab from './LojaOrdersTab.vue'
import LojaMenuTab from './LojaMenuTab.vue'
import { useAuthStore } from '../../stores/auth'
import { useCatalogStore } from '../../stores/catalog'
import { useOrdersStore } from '../../stores/orders'
import { formatCurrency } from '../../utils/formatters'

const auth = useAuthStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const tab = ref('pedidos')
</script>
