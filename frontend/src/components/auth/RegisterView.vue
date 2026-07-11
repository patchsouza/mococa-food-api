<template>
  <div class="view auth-screen">
    <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
      <h2 style="text-align:center; margin-bottom:24px;">O que você é?</h2>
      <div class="role-selector">
        <div class="role-btn" :class="{ active: form.role === 'cliente' }" @click="form.role = 'cliente'">
          <i class="fas fa-user"></i> Cliente
        </div>
        <div class="role-btn" :class="{ active: form.role === 'loja' }" @click="form.role = 'loja'">
          <i class="fas fa-store"></i> Loja
        </div>
        <div class="role-btn" :class="{ active: form.role === 'moto' }" @click="form.role = 'moto'">
          <i class="fas fa-motorcycle"></i> Moto
        </div>
      </div>

      <div class="input-group">
        <label>Nome Completo</label>
        <input v-model="form.name" type="text">
      </div>
      <div class="input-group">
        <label>E-mail</label>
        <input v-model="form.email" type="email">
      </div>

      <button class="btn btn-primary" @click="auth.register(form)">Criar conta</button>
      <p style="text-align:center; margin-top:16px; font-size:0.9rem;">
        <a href="#" style="color:var(--text-light);" @click.prevent="nav.goBack()">
          <i class="fas fa-arrow-left"></i> Voltar para login
        </a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useNavigationStore } from '../../stores/navigation'

const auth = useAuthStore()
const nav = useNavigationStore()
const form = reactive({ name: '', email: '', role: 'cliente' })
</script>
