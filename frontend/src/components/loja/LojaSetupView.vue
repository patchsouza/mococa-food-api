<template>
  <div class="view">
    <AppHeader title="Monte sua loja" :show-back="nav.canGoBack" @back="nav.goBack()" />
    <div style="padding:20px;">
      <p style="margin-bottom:20px; color:var(--text-light);">Como os clientes vão te ver?</p>
      <div class="input-group">
        <label>Nome da Loja</label>
        <input v-model="form.name" type="text" placeholder="Ex: Cantina da Nonna">
      </div>
      <div class="input-group">
        <label>Categoria</label>
        <input v-model="form.category" type="text" placeholder="Ex: Italiana, Hamburgueria">
      </div>
      <div class="input-group">
        <label>Endereço da loja</label>
        <input v-model="form.street" type="text" placeholder="Rua">
      </div>
      <div class="input-group">
        <label>Número</label>
        <input v-model="form.number" type="text" placeholder="Número">
      </div>
      <div class="input-group">
        <label>Bairro</label>
        <input v-model="form.neighborhood" type="text" placeholder="Bairro">
      </div>
      <div class="input-group">
        <label>Localização aproximada (latitude, longitude)</label>
        <div style="display:flex; gap:8px;">
          <input v-model.number="form.lat" type="number" step="any" aria-label="Latitude">
          <input v-model.number="form.lng" type="number" step="any" aria-label="Longitude">
        </div>
      </div>
      <p v-if="catalog.error" role="alert" style="color:var(--primary);">{{ catalog.error }}</p>
      <button class="btn btn-primary" :disabled="submitting" @click="submit">
        {{ submitting ? 'Criando...' : 'Criar loja' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import { useCatalogStore } from '../../stores/catalog'
import { useNavigationStore } from '../../stores/navigation'

const catalog = useCatalogStore()
const nav = useNavigationStore()
const form = reactive({ name: '', category: '', street: '', number: '', neighborhood: '', city: 'Mococa', state: 'SP', lat: -21.46, lng: -47.00 })
const submitting = ref(false)

async function submit() {
  if (submitting.value || !form.name.trim() || !form.street.trim()) return
  submitting.value = true
  const restaurant = await catalog.createRestaurant({
    name: form.name.trim(),
    category: form.category.trim(),
    address: {
      street: form.street.trim(),
      number: form.number.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city,
      state: form.state,
      lat: Number(form.lat),
      lng: Number(form.lng)
    }
  })
  submitting.value = false
  if (!restaurant) return
  await catalog.loadRestaurant(restaurant.id)
  nav.reset('loja-dashboard')
}
</script>
