<template>
  <div class="view">
    <AppHeader :title="`Olá, ${auth.currentUser.name}`" subtitle="Entregas" show-logout @logout="auth.logout()" />

    <div class="toggle-switch">
      <div>
        <h3>Status</h3>
        <p style="font-size:0.85rem; color:var(--text-light);">
          {{ courier.available ? 'Disponível para corridas' : 'Indisponível' }}
        </p>
      </div>
      <label class="switch">
        <input :checked="courier.available" type="checkbox" @change="courier.setAvailable($event.target.checked)">
        <span class="slider"></span>
      </label>
    </div>
    <p v-if="courier.error" role="alert" style="padding:0 16px; color:var(--primary);">{{ courier.error }}</p>

    <div style="padding: 0 16px;">
      <div class="stats-grid">
        <div class="stat-card">
          <h4>Saldo</h4>
          <p>{{ formatCurrency(courier.balance) }}</p>
        </div>
        <div class="stat-card">
          <h4>Avaliação</h4>
          <p>{{ courier.rating.toFixed(1) }} <i class="fas fa-star" style="color:var(--warning); font-size:0.9rem;"></i></p>
        </div>
      </div>

      <div v-if="courier.activeDelivery" class="card" style="border-left: 4px solid var(--success);">
        <h3 style="margin-bottom:12px;">Rota em andamento</h3>
        <p style="font-size:0.9rem; margin-bottom:8px;"><strong>Pedido #{{ courier.activeDelivery.id.slice(-4) }}</strong></p>
        <p style="font-size:0.85rem; margin-bottom:4px;">
          <i class="fas fa-store" style="width:20px;"></i> Coletar em: {{ courier.activeDelivery.restaurantName || catalog.getRestaurantName(courier.activeDelivery.restaurantId) }}
        </p>
        <p style="font-size:0.85rem; margin-bottom:12px;">
          <i class="fas fa-map-marker-alt" style="width:20px;"></i> Entregar para: {{ formatAddress(courier.activeDelivery.deliveryAddress) }}
        </p>
        <button class="btn btn-success" @click="courier.confirmDelivery()">Confirmar entrega</button>
      </div>

      <div v-else>
        <h3 style="margin: 20px 0 12px;">Pedidos disponíveis</h3>
        <EmptyState v-if="!courier.available" icon="fas fa-pause-circle" message='Ative "Disponível" para começar a receber corridas.' />
        <EmptyState
          v-else-if="courier.availableDeliveries.length === 0"
          icon="fas fa-search"
          :message="`Buscando pedidos prontos num raio de ${courier.radiusKm} km...`"
        />
        <div v-else>
          <div v-for="o in courier.availableDeliveries" :key="o.id" class="card">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <h3 style="font-size:1rem;">#{{ o.id.slice(-4) }}</h3>
            </div>
            <p style="font-size:0.85rem; margin-bottom:4px;"><i class="fas fa-store" style="width:20px;"></i> {{ o.restaurantName || catalog.getRestaurantName(o.restaurantId) }}</p>
            <p style="font-size:0.85rem; margin-bottom:12px;"><i class="fas fa-map-marker-alt" style="width:20px;"></i> {{ formatAddress(o.deliveryAddress) }}</p>
            <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:12px;">
              <span>Taxa</span>
              <span style="color:var(--success);">{{ formatCurrency(o.deliveryFee) }}</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button
                class="btn btn-sm btn-success"
                style="flex:1;"
                :disabled="Boolean(courier.acceptingOrderId)"
                @click="courier.acceptDelivery(o)"
              >
                {{ courier.acceptingOrderId === o.id ? 'Aceitando...' : 'Aceitar corrida' }}
              </button>
              <button class="btn btn-sm btn-secondary" @click="courier.rejectDelivery(o.id)">Recusar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import EmptyState from '../layout/EmptyState.vue'
import { useAuthStore } from '../../stores/auth'
import { useCatalogStore } from '../../stores/catalog'
import { useCourierStore } from '../../stores/courier'
import { formatAddress, formatCurrency } from '../../utils/formatters'

const auth = useAuthStore()
const catalog = useCatalogStore()
const courier = useCourierStore()

let offersTimer = null

onMounted(async () => {
  await courier.loadDashboard()
  await courier.loadOffers()
  offersTimer = setInterval(() => {
    if (courier.available) courier.loadOffers()
  }, 10000)
})

onBeforeUnmount(() => clearInterval(offersTimer))
</script>
