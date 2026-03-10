<template>
  <div class="auth-page">
    <AuthCard>
      <template #header>
        <div class="icon-header">
          <svg class="icon icon-success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 class="auth-title">Пароль был восстановлен</h1>
      </template>

      <p class="description">
        Перейдите на страницу авторизации, чтобы войти в систему с новым паролем
      </p>

      <template #footer>
        <BaseButton
          type="button"
          variant="primary"
          @click="goToLogin"
        >
          Назад в авторизацию
        </BaseButton>
      </template>
    </AuthCard>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { AuthCard, BaseButton } from '@/components/shared';

const router = useRouter();

function goToLogin() {
  router.push('/login');
}
</script>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.icon-header {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.icon {
  width: 64px;
  height: 64px;

  &.icon-success {
    color: #10b981;
  }
}

.auth-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  text-align: center;
}

.description {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.6;
  text-align: center;
  margin-bottom: 1.5rem;
}
</style>
