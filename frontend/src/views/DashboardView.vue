<template>
  <div class="dashboard-page">
    <div class="dashboard-card">
      <h1 class="dashboard-title">Добро пожаловать!</h1>
      <p class="dashboard-text">
        Вы успешно вошли в систему как <strong>{{ authStore.user?.email }}</strong>
      </p>
      <BaseButton
        type="button"
        variant="secondary"
        @click="handleLogout"
      >
        Выйти
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { BaseButton } from '@/components/shared';
import { LOGOUT } from '@/graphql/queries';

const router = useRouter();
const authStore = useAuthStore();

async function handleLogout() {
  try {
    // Call server-side logout to revoke refresh token
    const response = await fetch(
      import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: LOGOUT,
          variables: {
            refreshToken: authStore.tokens?.refreshToken,
            userId: authStore.user?.id,
          },
        }),
      },
    );

    await response.json();
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local state regardless of server response
    authStore.logout();
    router.push('/login');
  }
}
</script>

<style lang="scss" scoped>
.dashboard-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.dashboard-card {
  max-width: 420px;
  padding: 2.5rem;
  background-color: #fff;
  border-radius: 1rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.dashboard-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.dashboard-text {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 2rem 0;

  strong {
    color: #6366f1;
  }
}
</style>
