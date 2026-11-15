<template>
  <main class="admin-area">
    <section v-if="!admin" class="admin-login">
      <div class="admin-login__brand">
        <span class="admin-mark">M</span>
        <span>Mococa <b>Food</b></span>
        <small>OPERAÇÕES</small>
      </div>

      <div class="admin-login__content">
        <p class="admin-kicker">ACESSO ADMINISTRATIVO</p>
        <h1>Central de<br>operações</h1>
        <p class="admin-login__description">Entre com uma conta administrativa autorizada.</p>

        <form class="admin-login__form" @submit.prevent="login">
          <label for="admin-email">E-mail administrativo</label>
          <input id="admin-email" v-model.trim="credentials.email" type="email" autocomplete="username" required placeholder="nome@empresa.com">

          <label for="admin-password">Senha</label>
          <input id="admin-password" v-model="credentials.password" type="password" autocomplete="current-password" required placeholder="Sua senha">

          <p v-if="error" class="admin-alert" role="alert">{{ error }}</p>
          <button class="admin-button admin-button--primary" type="submit" :disabled="loading">
            {{ loading ? 'Verificando acesso...' : 'Entrar no painel' }}
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </form>
        <p class="admin-login__footnote"><i class="fas fa-lock" aria-hidden="true"></i> Sessão administrativa independente</p>
      </div>
      <div class="admin-login__side" aria-hidden="true">
        <span class="admin-side__index">01 / OPERAÇÃO</span>
        <div class="admin-side__line"></div>
        <p>Comércio local,<br><em>em movimento.</em></p>
        <span class="admin-side__city">MOCOCA · SP</span>
      </div>
    </section>

    <section v-else class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-sidebar__brand">
          <span class="admin-mark">M</span>
          <span>Mococa <b>Food</b><small>ADMIN</small></span>
        </div>
        <p class="admin-nav-label">GESTÃO</p>
        <nav class="admin-nav" aria-label="Navegação administrativa">
          <button class="admin-nav__item is-active" type="button"><i class="fas fa-chart-pie" aria-hidden="true"></i> Visão geral</button>
          <button class="admin-nav__item" type="button" disabled><i class="fas fa-store" aria-hidden="true"></i> Lojas</button>
          <button class="admin-nav__item" type="button" disabled><i class="fas fa-receipt" aria-hidden="true"></i> Pedidos</button>
          <button class="admin-nav__item" type="button" disabled><i class="fas fa-money-bill-wave" aria-hidden="true"></i> Pagamentos</button>
          <button class="admin-nav__item" type="button" disabled><i class="fas fa-users" aria-hidden="true"></i> Pessoas</button>
        </nav>
        <div class="admin-sidebar__bottom">
          <span class="admin-status"><i></i> Ambiente administrativo</span>
          <button class="admin-logout" type="button" @click="logout"><i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i> Encerrar sessão</button>
        </div>
      </aside>

      <div class="admin-main">
        <header class="admin-topbar">
          <span>ADMINISTRAÇÃO <i class="fas fa-chevron-right" aria-hidden="true"></i> VISÃO GERAL</span>
          <div class="admin-user"><span class="admin-user__avatar">{{ initials }}</span><span>{{ admin.name || admin.email }}</span></div>
        </header>

        <div class="admin-content">
          <div class="admin-page-heading">
            <div>
              <p class="admin-kicker">DOMINGO, 15 DE NOVEMBRO</p>
              <h1>Visão geral</h1>
              <p>Operação da plataforma em um só lugar.</p>
            </div>
            <button class="admin-button admin-button--quiet" type="button" :disabled="dashboardLoading" @click="loadDashboard">
              <i class="fas fa-rotate" aria-hidden="true"></i> Atualizar
            </button>
          </div>

          <p v-if="dashboardError" class="admin-alert admin-alert--wide" role="status">{{ dashboardError }}</p>

          <div class="admin-metrics" aria-label="Indicadores operacionais">
            <article v-for="metric in metrics" :key="metric.label" class="admin-metric">
              <div class="admin-metric__top"><span>{{ metric.label }}</span><i :class="metric.icon" aria-hidden="true"></i></div>
              <strong>{{ dashboardLoading ? '…' : metric.value }}</strong>
              <small>{{ metric.note }}</small>
            </article>
          </div>

          <section class="admin-overview-grid">
            <article class="admin-panel admin-panel--activity">
              <div class="admin-panel__heading"><div><p class="admin-kicker">ACOMPANHAMENTO</p><h2>Atividade recente</h2></div><span class="admin-live"><i></i> AO VIVO</span></div>
              <div v-if="dashboardLoading" class="admin-empty"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i><span>Carregando dados da operação...</span></div>
              <div v-else-if="dashboardError" class="admin-empty"><i class="fas fa-plug-circle-xmark" aria-hidden="true"></i><span>Aguardando conexão com a API administrativa.</span></div>
              <div v-else class="admin-empty"><i class="fas fa-inbox" aria-hidden="true"></i><span>Sem atividade para exibir.</span></div>
            </article>
            <article class="admin-panel admin-panel--status">
              <div class="admin-panel__heading"><div><p class="admin-kicker">SISTEMA</p><h2>Serviços</h2></div></div>
              <div class="admin-service"><span class="admin-service__dot" :class="{ 'is-warning': dashboardError }"></span><span>API administrativa</span><b>{{ dashboardError ? 'Indisponível' : dashboardLoading ? 'Verificando' : 'Conectada' }}</b></div>
              <div class="admin-service"><span class="admin-service__dot is-muted"></span><span>Pagamentos</span><b>—</b></div>
              <div class="admin-service"><span class="admin-service__dot is-muted"></span><span>Entregas</span><b>—</b></div>
            </article>
          </section>
          <p class="admin-disclaimer">O acesso ao painel depende de autenticação e autorização no servidor; o endereço não substitui essas proteções.</p>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { adminApi, setAdminAuthToken } from '../../utils/api'

const admin = ref(null)
const loading = ref(false)
const dashboardLoading = ref(false)
const error = ref('')
const dashboardError = ref('')
const dashboard = ref(null)
const credentials = reactive({ email: '', password: '' })

const initials = computed(() => (admin.value?.name || admin.value?.email || 'AD').slice(0, 2).toUpperCase())
const metrics = computed(() => [
  { label: 'LOJAS EM ANÁLISE', value: dashboard.value?.pendingRestaurants ?? '—', note: 'Aguardando aprovação', icon: 'fas fa-store' },
  { label: 'PEDIDOS EM ANDAMENTO', value: dashboard.value?.activeOrders ?? '—', note: 'Em toda a plataforma', icon: 'fas fa-box' },
  { label: 'PAGAMENTOS HOJE', value: dashboard.value?.paymentsToday ?? '—', note: 'Transações confirmadas', icon: 'fas fa-arrow-trend-up' },
  { label: 'USUÁRIOS ATIVOS', value: dashboard.value?.activeUsers ?? '—', note: 'Clientes e parceiros', icon: 'fas fa-users' }
])

async function loadDashboard() {
  dashboardLoading.value = true
  dashboardError.value = ''
  try {
    dashboard.value = await adminApi.dashboard()
  } catch (requestError) {
    dashboardError.value = requestError.status === 404
      ? 'A autenticação administrativa ainda não está disponível na API. O painel está preparado para os endpoints /api/admin.'
      : requestError.message || 'Não foi possível carregar os dados administrativos.'
  } finally {
    dashboardLoading.value = false
  }
}

async function login() {
  loading.value = true
  error.value = ''
  try {
    const result = await adminApi.login(credentials)
    if (!result?.token || !result?.admin) throw new Error('Resposta administrativa inválida da API.')
    setAdminAuthToken(result.token)
    admin.value = result.admin
    await loadDashboard()
  } catch (requestError) {
    error.value = requestError.status === 404
      ? 'A API ainda não possui login administrativo separado. Nenhuma conta comum foi aceita como admin.'
      : requestError.message || 'Não foi possível autenticar esta conta administrativa.'
  } finally {
    loading.value = false
  }
}

async function logout() {
  try {
    await adminApi.logout()
  } finally {
    setAdminAuthToken(null)
    admin.value = null
    dashboard.value = null
    dashboardError.value = ''
  }
}

onMounted(async () => {
  if (!localStorage.getItem('mococa-admin-token')) return
  try {
    admin.value = await adminApi.me()
    await loadDashboard()
  } catch {
    setAdminAuthToken(null)
  }
})
</script>

<style scoped>
.admin-area {
  --admin-ink: #1d2925;
  --admin-muted: #68756f;
  --admin-paper: #f3f5ef;
  --admin-white: #fff;
  --admin-line: #e2e7df;
  --admin-green: #236c53;
  --admin-green-soft: #e4f0e9;
  --admin-orange: #d97742;
  min-height: 100vh;
  width: 100%;
  color: var(--admin-ink);
  background: var(--admin-paper);
  font-family: "DM Sans", sans-serif;
}

.admin-login { display: grid; grid-template-columns: minmax(430px, 1fr) minmax(320px, .82fr); min-height: 100vh; background: #fbfcf8; }
.admin-login__brand { position: absolute; top: 34px; left: 5.5vw; display: flex; align-items: center; gap: 10px; color: var(--admin-ink); font-size: 15px; font-weight: 600; }
.admin-login__brand b, .admin-sidebar__brand b { font-weight: 400; color: var(--admin-green); }
.admin-login__brand small { margin-left: 9px; color: #8c9891; font-size: 9px; letter-spacing: 1.3px; }
.admin-mark { display: grid; place-items: center; width: 34px; aspect-ratio: 1; background: var(--admin-green); color: white; font-family: "DM Serif Display", serif; font-size: 21px; }
.admin-login__content { width: min(390px, calc(100% - 48px)); margin: auto; padding: 120px 0 64px; }
.admin-kicker { margin: 0 0 12px; color: var(--admin-green); font-size: 10px; font-weight: 700; letter-spacing: 1.45px; }
.admin-login h1 { margin: 0; font-family: "DM Serif Display", serif; font-size: clamp(42px, 5vw, 61px); font-weight: 400; line-height: 1.02; }
.admin-login__description { margin: 17px 0 34px; color: var(--admin-muted); font-size: 14px; }
.admin-login__form { display: grid; gap: 10px; }
.admin-login__form label { margin-top: 5px; font-size: 12px; font-weight: 600; }
.admin-login__form input { width: 100%; height: 48px; padding: 0 14px; border: 1px solid #dfe5dc; border-radius: 4px; outline: none; background: white; color: var(--admin-ink); font-size: 14px; }
.admin-login__form input:focus { border-color: var(--admin-green); box-shadow: 0 0 0 3px rgba(35,108,83,.1); }
.admin-button { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 42px; padding: 0 16px; border: 0; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 650; transition: background .18s ease, transform .18s ease; }
.admin-button:not(:disabled):hover { transform: translateY(-1px); }
.admin-button--primary { justify-content: space-between; min-height: 49px; margin-top: 14px; background: var(--admin-green); color: white; }
.admin-button--primary:hover { background: #19553f; }
.admin-button--quiet { border: 1px solid var(--admin-line); background: white; color: var(--admin-ink); }
.admin-login__footnote { margin: 22px 0 0; color: #87918b; font-size: 11px; }
.admin-login__footnote i { margin-right: 6px; color: var(--admin-green); }
.admin-login__side { position: relative; display: flex; flex-direction: column; justify-content: flex-end; min-height: 100vh; padding: 56px; overflow: hidden; background: #223b31; color: white; }
.admin-login__side::before { position: absolute; top: -18%; right: -25%; width: 75%; aspect-ratio: 1; border: 1px solid rgba(255,255,255,.12); border-radius: 50%; content: ""; }
.admin-login__side::after { position: absolute; top: -8%; right: -15%; width: 62%; aspect-ratio: 1; border: 1px solid rgba(255,255,255,.09); border-radius: 50%; content: ""; }
.admin-side__index, .admin-side__city { position: absolute; z-index: 1; color: rgba(255,255,255,.58); font-size: 9px; letter-spacing: 1.6px; }
.admin-side__index { top: 42px; left: 42px; }
.admin-side__city { right: 42px; bottom: 42px; }
.admin-side__line { width: 40px; height: 2px; margin-bottom: 20px; background: var(--admin-orange); }
.admin-login__side p { position: relative; z-index: 1; margin: 0 0 30px; font-family: "DM Serif Display", serif; font-size: clamp(35px, 4vw, 56px); line-height: 1.1; }
.admin-login__side em { color: #e6a47d; font-weight: 400; }
.admin-alert { margin: 8px 0 0; padding: 11px 12px; border-left: 3px solid #bd573b; background: #fff0e9; color: #8d3926; font-size: 12px; }

.admin-shell { display: flex; min-height: 100vh; }
.admin-sidebar { position: sticky; top: 0; display: flex; flex: 0 0 238px; flex-direction: column; height: 100vh; padding: 26px 16px 18px; border-right: 1px solid var(--admin-line); background: #fbfcf8; }
.admin-sidebar__brand { display: flex; align-items: center; gap: 10px; padding: 0 9px 32px; font-size: 14px; font-weight: 600; }
.admin-sidebar__brand > span:last-child { display: grid; grid-template-columns: auto auto; align-items: center; column-gap: 7px; }
.admin-sidebar__brand small { color: #849089; font-size: 8px; letter-spacing: 1.1px; }
.admin-nav-label { margin: 0 10px 9px; color: #98a29c; font-size: 9px; font-weight: 700; letter-spacing: 1.4px; }
.admin-nav { display: grid; gap: 4px; }
.admin-nav__item { display: flex; align-items: center; gap: 12px; min-height: 42px; padding: 0 11px; border: 0; border-radius: 4px; background: transparent; color: #53615a; text-align: left; font-size: 12px; }
.admin-nav__item i { width: 16px; color: #77857d; text-align: center; }
.admin-nav__item.is-active { background: var(--admin-green-soft); color: #1d5e46; font-weight: 650; }
.admin-nav__item.is-active i { color: var(--admin-green); }
.admin-nav__item:disabled { opacity: .48; }
.admin-sidebar__bottom { display: grid; gap: 14px; margin-top: auto; padding: 14px 10px 4px; border-top: 1px solid var(--admin-line); }
.admin-status { color: #718078; font-size: 10px; }
.admin-status i, .admin-live i { display: inline-block; width: 7px; aspect-ratio: 1; margin-right: 6px; border-radius: 50%; background: #52a578; }
.admin-logout { display: flex; align-items: center; gap: 9px; padding: 4px 0; border: 0; background: none; color: #53615a; cursor: pointer; text-align: left; font-size: 11px; }
.admin-main { flex: 1; min-width: 0; }
.admin-topbar { display: flex; align-items: center; justify-content: space-between; min-height: 60px; padding: 0 34px; border-bottom: 1px solid var(--admin-line); background: rgba(255,255,255,.62); }
.admin-topbar > span { color: #8a968e; font-size: 9px; font-weight: 700; letter-spacing: 1.1px; }
.admin-topbar > span i { margin: 0 9px; font-size: 8px; }
.admin-user { display: flex; align-items: center; gap: 9px; color: #526058; font-size: 11px; }
.admin-user__avatar { display: grid; place-items: center; width: 29px; aspect-ratio: 1; border-radius: 50%; background: #dfebe3; color: var(--admin-green); font-size: 10px; font-weight: 700; }
.admin-content { width: min(1240px, 100%); margin: 0 auto; padding: 38px 34px 30px; }
.admin-page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 27px; }
.admin-page-heading .admin-kicker { margin-bottom: 8px; }
.admin-page-heading h1 { margin: 0; font-family: "DM Serif Display", serif; font-size: 34px; font-weight: 400; line-height: 1.1; }
.admin-page-heading p:last-child { margin: 8px 0 0; color: var(--admin-muted); font-size: 12px; }
.admin-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.admin-metric { min-width: 0; padding: 17px 17px 16px; border: 1px solid var(--admin-line); border-radius: 5px; background: white; }
.admin-metric__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #7e8a82; font-size: 9px; font-weight: 700; letter-spacing: .75px; }
.admin-metric__top i { color: var(--admin-green); font-size: 13px; }
.admin-metric strong { display: block; margin-top: 19px; font-size: 28px; font-weight: 500; line-height: 1; }
.admin-metric small { display: block; margin-top: 9px; color: #8a958e; font-size: 10px; }
.admin-overview-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(240px, .9fr); gap: 12px; margin-top: 14px; }
.admin-panel { min-width: 0; min-height: 250px; padding: 19px; border: 1px solid var(--admin-line); border-radius: 5px; background: white; }
.admin-panel__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.admin-panel__heading .admin-kicker { margin-bottom: 6px; font-size: 9px; }
.admin-panel__heading h2 { margin: 0; font-size: 15px; font-weight: 600; }
.admin-live { padding-top: 3px; color: #568369; font-size: 8px; font-weight: 700; letter-spacing: 1px; }
.admin-live i { width: 6px; margin-right: 3px; }
.admin-empty { display: grid; place-items: center; gap: 10px; min-height: 160px; color: #929d95; text-align: center; font-size: 11px; }
.admin-empty i { color: #a4b4aa; font-size: 21px; }
.admin-service { display: grid; grid-template-columns: 9px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-height: 48px; border-bottom: 1px solid #edf0ea; color: #59665f; font-size: 11px; }
.admin-service:last-child { border-bottom: 0; }
.admin-service b { color: #4a795e; font-size: 10px; font-weight: 600; }
.admin-service__dot { width: 7px; aspect-ratio: 1; border-radius: 50%; background: #53a477; }
.admin-service__dot.is-warning { background: #d18449; }
.admin-service__dot.is-muted { background: #b7c0ba; }
.admin-disclaimer { margin: 18px 0 0; color: #89948d; font-size: 10px; }
.admin-alert--wide { margin: -10px 0 16px; }

@media (max-width: 900px) {
  .admin-login { grid-template-columns: minmax(360px, 1fr) minmax(250px, .7fr); }
  .admin-sidebar { flex-basis: 205px; }
  .admin-content { padding: 30px 22px; }
  .admin-topbar { padding: 0 22px; }
  .admin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .admin-login { display: block; min-height: 100vh; }
  .admin-login__brand { top: 22px; left: 22px; }
  .admin-login__content { padding: 120px 0 52px; }
  .admin-login__side { display: none; }
  .admin-sidebar { position: static; flex-basis: auto; width: 100%; height: auto; padding: 14px 14px 10px; border-right: 0; border-bottom: 1px solid var(--admin-line); }
  .admin-sidebar__brand { padding: 0 4px 12px; }
  .admin-nav-label, .admin-sidebar__bottom { display: none; }
  .admin-nav { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 2px; }
  .admin-nav__item { flex: 0 0 auto; min-height: 35px; padding: 0 9px; white-space: nowrap; font-size: 10px; }
  .admin-nav__item i { width: auto; }
  .admin-shell { display: block; }
  .admin-topbar { min-height: 50px; padding: 0 16px; }
  .admin-topbar > span { font-size: 8px; }
  .admin-user { font-size: 0; }
  .admin-content { padding: 25px 16px; }
  .admin-page-heading { align-items: flex-start; }
  .admin-page-heading h1 { font-size: 30px; }
  .admin-button--quiet { min-height: 36px; padding: 0 10px; font-size: 10px; }
  .admin-metrics { gap: 8px; }
  .admin-metric { padding: 13px 12px; }
  .admin-metric__top { align-items: flex-start; font-size: 8px; }
  .admin-metric strong { margin-top: 15px; font-size: 24px; }
  .admin-overview-grid { grid-template-columns: 1fr; }
}
</style>