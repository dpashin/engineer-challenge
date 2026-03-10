<template>
  <div class="auth-page">
    <AuthCard>
      <template #header>
        <div class="icon-header">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 class="auth-title">Проверьте свою почту</h1>
      </template>

      <p class="description">
        Мы отправили на вашу почту письмо с ссылкой для восстановления пароля.
        Перейдите по ссылке в письме, чтобы продолжить.
      </p>

      <template #footer>
        <BaseButton
          type="button"
          variant="link"
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
  color: #6366f1;
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
