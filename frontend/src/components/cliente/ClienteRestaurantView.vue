<template>
  <div class="view">
    <AppHeader
      :title="restaurant.name"
      :subtitle="restaurant.description"
      :show-back="nav.canGoBack"
      @back="nav.goBack()"
    />

    <div style="padding: 12px 16px; background:white; border-bottom:1px solid var(--border); font-size:0.85rem; color:var(--text-light);">
      Entrega: {{ formatCurrency(restaurant.deliveryFee) }} · mín. {{ formatCurrency(restaurant.minOrderValue) }}
    </div>

    <div v-for="cat in categories" :key="cat">
      <div class="menu-cat">{{ cat }}</div>
      <div class="card" style="margin-top:0;">
        <div v-for="p in catalog.getMenuByCategory(restaurant.id, cat)" :key="p.id" class="menu-item">
          <div class="item-info">
            <h4>{{ p.name }}</h4>
            <p>{{ p.description }}</p>
            <span style="color:var(--primary); font-weight:700;">{{ formatCurrency(p.price) }}</span>
          </div>
          <button class="btn btn-sm btn-primary" @click="cart.addItem(p)">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
    </div>

    <div v-if="cart.items.length > 0" class="fab" @click="nav.navigateTo('cliente-cart')">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="background:white; color:var(--primary); width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.8rem;">
          {{ cart.qty }}
        </span>
        <span style="font-weight:600;">Ver sacola</span>
      </div>
      <span style="font-weight:700;">{{ formatCurrency(cart.total) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import { useCatalogStore } from '../../stores/catalog'
import { useCartStore } from '../../stores/cart'
import { useNavigationStore } from '../../stores/navigation'
import { formatCurrency } from '../../utils/formatters'

const catalog = useCatalogStore()
const cart = useCartStore()
const nav = useNavigationStore()

const restaurant = computed(() => cart.selectedRestaurant)
const categories = computed(() => catalog.menuCategoriesFor(restaurant.value.id))
</script>
