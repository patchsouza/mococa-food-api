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
        <input v-model="form.address" type="text" placeholder="Rua, Número">
      </div>
      <button class="btn btn-primary" @click="submit">Criar loja</button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import AppHeader from '../layout/AppHeader.vue'
import { useCatalogStore } from '../../stores/catalog'
import { useNavigationStore } from '../../stores/navigation'

const catalog = useCatalogStore()
const nav = useNavigationStore()
const form = reactive({ name: '', category: '', address: '' })

function submit() {
  catalog.createRestaurant(form)
  nav.reset('loja-dashboard')
}
</script>
