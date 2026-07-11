<template>
  <div class="header">
    <button v-if="showBack" class="back-btn" @click="$emit('back')">
      <i class="fas fa-arrow-left"></i>
    </button>
    <div style="flex:1;">
      <h1>{{ title }}</h1>
      <p v-if="subtitle" style="font-size:0.85rem; opacity:0.9;">{{ subtitle }}</p>
    </div>
    <slot name="actions" />
    <button v-if="showLogout" class="back-btn" title="Sair" @click="$emit('logout')">
      <i class="fas fa-sign-out-alt"></i>
    </button>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  showLogout: { type: Boolean, default: false }
})

defineEmits(['back', 'logout'])
</script>
