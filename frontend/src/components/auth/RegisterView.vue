<template>
  <div class="view auth-screen">
    <div class="auth-layout">
      <section class="auth-story" aria-label="Mococa Food">
        <div class="auth-story__brand">Mococa <span>Food</span></div>
        <div class="auth-story__copy">
          <span class="auth-eyebrow">A CIDADE À SUA MESA</span>
          <h1>Tem lugar para todo mundo.</h1>
          <p>Peça, cozinhe ou faça entregas em Mococa.</p>
        </div>
        <span class="auth-story__note">Mococa, SP · Comida local</span>
      </section>

      <section class="auth-panel">
        <div class="auth-form-head">
          <span class="auth-eyebrow">COMECE POR AQUI</span>
          <h2>Crie sua conta</h2>
          <p>Escolha como quer fazer parte.</p>
        </div>
        <div class="role-selector" role="group" aria-label="Tipo de conta">
          <button type="button" class="role-btn" :class="{ active: form.role === 'cliente' }" :aria-pressed="form.role === 'cliente'" @click="form.role = 'cliente'">
            <i class="fas fa-user" aria-hidden="true"></i><span>Cliente</span>
          </button>
          <button type="button" class="role-btn" :class="{ active: form.role === 'loja' }" :aria-pressed="form.role === 'loja'" @click="form.role = 'loja'">
            <i class="fas fa-store" aria-hidden="true"></i><span>Loja</span>
          </button>
          <button type="button" class="role-btn" :class="{ active: form.role === 'moto' }" :aria-pressed="form.role === 'moto'" @click="form.role = 'moto'">
            <i class="fas fa-motorcycle" aria-hidden="true"></i><span>Entrega</span>
          </button>
        </div>

        <div class="input-group">
          <label for="register-name">Nome completo</label>
          <input id="register-name" v-model="form.name" type="text" autocomplete="name" placeholder="Como podemos te chamar?">
        </div>
        <div class="input-group">
          <label for="register-email">E-mail</label>
          <input id="register-email" v-model="form.email" type="email" autocomplete="email" placeholder="seu@email.com">
        </div>

        <button class="btn btn-primary auth-submit" @click="auth.register(form)">Criar conta</button>
        <p class="auth-switch">
          <a href="#" @click.prevent="nav.goBack()"><i class="fas fa-arrow-left" aria-hidden="true"></i> Voltar para login</a>
        </p>
      </section>
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
