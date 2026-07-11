<template>
  <div style="margin-top:16px;">
    <EmptyState v-if="orders.storeOrders.length === 0" icon="fas fa-receipt" message="Nenhum pedido ativo por enquanto." />

    <div v-for="o in orders.storeOrders" :key="o.id" class="card order-card" :class="{ ready: o.status === 'ready' }">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <h3 style="font-size:1rem;">#{{ o.id.slice(-4) }}</h3>
        <span style="font-size:0.8rem; font-weight:600; color:var(--primary);">{{ statusLabel(o.status) }}</span>
      </div>
      <p style="font-size:0.9rem; margin-bottom:4px;">{{ o.customerName }}</p>
      <p style="font-size:0.8rem; color:var(--text-light); margin-bottom:12px;">
        {{ formatAddress(o.deliveryAddress) }} · {{ paymentLabel(o.paymentMethod) }}
      </p>
      <ul style="font-size:0.85rem; margin-bottom:12px; padding-left:20px;">
        <li v-for="i in o.items" :key="i.id">{{ i.quantity }}x {{ i.name }}</li>
      </ul>
      <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:12px;">
        <span>Total</span>
        <span>{{ formatCurrency(o.total) }}</span>
      </div>
      <div class="order-actions">
        <button v-if="o.status === 'pending'" class="btn btn-sm btn-success" @click="orders.updateStatus(o.id, 'accepted')">Confirmar</button>
        <button v-if="o.status === 'pending'" class="btn btn-sm btn-danger" @click="orders.updateStatus(o.id, 'rejected')">Recusar</button>
        <button v-if="o.status === 'accepted'" class="btn btn-sm btn-primary" @click="orders.updateStatus(o.id, 'preparing')">Iniciar preparo</button>
        <button v-if="o.status === 'preparing'" class="btn btn-sm btn-success" @click="orders.updateStatus(o.id, 'ready')">Pronto para retirada</button>
        <span v-if="o.status === 'ready'" style="color:var(--success); font-size:0.85rem; font-weight:600; display:flex; align-items:center;">
          <i class="fas fa-clock" style="margin-right:6px;"></i> Aguardando entregador...
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import EmptyState from '../layout/EmptyState.vue'
import { useOrdersStore } from '../../stores/orders'
import { paymentLabel, formatAddress, statusLabel, formatCurrency } from '../../utils/formatters'

const orders = useOrdersStore()
</script>
