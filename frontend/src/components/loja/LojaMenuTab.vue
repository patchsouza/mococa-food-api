<template>
  <div style="margin-top:16px;">
    <div class="card">
      <h3 style="margin-bottom:12px;">Adicionar item</h3>
      <div class="input-group"><input v-model="newItem.name" type="text" placeholder="Nome do item"></div>
      <div class="input-group"><input v-model="newItem.category" type="text" placeholder="Categoria (ex: Massas)"></div>
      <div class="input-group"><input v-model="newItem.price" type="number" placeholder="Preço"></div>
      <button class="btn btn-primary" @click="submit">Salvar item</button>
    </div>

    <EmptyState v-if="catalog.myMenu.length === 0" message="Nenhum item cadastrado ainda." />

    <div v-for="p in catalog.myMenu" :key="p.id" class="card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h4 style="font-size:0.95rem;">{{ p.name }}</h4>
        <p style="font-size:0.8rem; color:var(--text-light);">{{ p.category }} · {{ formatCurrency(p.price) }}</p>
      </div>
      <button class="btn btn-sm btn-danger" @click="catalog.removeMenuItem(p.id)"><i class="fas fa-trash"></i></button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import EmptyState from '../layout/EmptyState.vue'
import { useCatalogStore } from '../../stores/catalog'
import { formatCurrency } from '../../utils/formatters'

const catalog = useCatalogStore()
const newItem = reactive({ name: '', category: '', price: 0 })

function submit() {
  if (!newItem.name || !newItem.price) return
  catalog.addMenuItem({ ...newItem })
  newItem.name = ''
  newItem.category = ''
  newItem.price = 0
}
</script>
