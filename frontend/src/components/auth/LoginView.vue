<template>
  <div class="view auth-screen">
    <div class="auth-layout">
      <section class="auth-story" aria-label="Mococa Food">
        <div class="auth-story__brand">Mococa <span>Food</span></div>
        <div class="auth-story__copy">
          <span class="auth-eyebrow">FEITO AQUI, PERTO DE VOCÊ</span>
          <h1>O melhor da cidade chega quentinho.</h1>
          <p>Seu próximo prato favorito está logo ali.</p>
        </div>
        <span class="auth-story__note">Mococa, SP · Comida local</span>
      </section>

      <section class="auth-panel">
        <div class="auth-form-head">
          <span class="auth-eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>Entre na sua conta</h2>
          <p>Peça de quem cozinha pertinho.</p>
        </div>

        <div class="input-group">
          <label for="login-email">E-mail ou telefone</label>
          <input id="login-email" v-model="form.email" type="text" placeholder="seu@email.com" autocomplete="username">
        </div>
        <div class="input-group">
          <label for="login-password">Senha</label>
          <input id="login-password" v-model="form.password" type="password" placeholder="Sua senha" autocomplete="current-password">
        </div>

        <button class="btn btn-primary auth-submit" @click="auth.login()">Entrar</button>
        <p class="auth-switch">
          Ainda não tem conta?
          <a href="#" @click.prevent="nav.navigateTo('register')">Criar conta</a>
        </p>

        <div class="quick-test">
          <p>ACESSO DE DEMONSTRAÇÃO</p>
          <div class="quick-test-btns">
            <button type="button" @click="auth.quickLogin('cliente')"><i class="fas fa-user" aria-hidden="true"></i> Cliente</button>
            <button type="button" @click="auth.quickLogin('loja')"><i class="fas fa-store" aria-hidden="true"></i> Loja</button>
            <button type="button" @click="auth.quickLogin('moto')"><i class="fas fa-motorcycle" aria-hidden="true"></i> Entrega</button>
          </div>
        </div>
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
const form = reactive({ email: '', password: '' })
</script>
