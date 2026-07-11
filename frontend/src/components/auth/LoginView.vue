<template>
  <div class="view auth-screen">
    <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
      <div class="logo">Mococa Food</div>
      <div class="tagline">Do fogão da esquina até sua porta.</div>

      <div class="input-group">
        <label>E-mail ou Telefone</label>
        <input v-model="form.email" type="text" placeholder="seu@email.com">
      </div>
      <div class="input-group">
        <label>Senha</label>
        <input v-model="form.password" type="password" placeholder="••••••••">
      </div>

      <button class="btn btn-primary" @click="auth.login()">Entrar</button>
      <p style="text-align:center; margin-top:16px; font-size:0.9rem;">
        Ainda não tem conta?
        <a href="#" style="color:var(--primary); font-weight:600;" @click.prevent="nav.navigateTo('register')">Criar nova conta</a>
      </p>

      <div class="quick-test">
        <p>Acesso rápido de teste</p>
        <div class="quick-test-btns">
          <button @click="auth.quickLogin('cliente')"><i class="fas fa-user"></i> Cliente</button>
          <button @click="auth.quickLogin('loja')"><i class="fas fa-store"></i> Loja</button>
          <button @click="auth.quickLogin('moto')"><i class="fas fa-motorcycle"></i> Moto</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useNavigationStore } from '../../stores/navigation'

const auth = useAuthStore()
const nav = useNavigationStore()
const form = reactive({ email: '', password: '' })
</script>
