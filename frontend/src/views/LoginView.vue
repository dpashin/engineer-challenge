<template>
  <div class="auth-page">
    <AuthCard title="Вход в систему">
      <form @submit.prevent="handleSubmit">
        <BaseInput
          v-model="email"
          type="email"
          label="E-mail"
          placeholder="Введите email"
          :error="errors.email"
          :disabled="isLoading"
        />

        <BaseInput
          v-model="password"
          type="password"
          label="Пароль"
          placeholder="Введите пароль"
          :error="errors.password"
          :disabled="isLoading"
        />

        <BaseButton
          type="submit"
          variant="primary"
          :loading="isLoading"
          :disabled="!isValid"
        >
          Войти
        </BaseButton>
      </form>

      <template #footer>
        <div class="auth-footer-links">
          <router-link to="/forgot-password" class="auth-link">
            Забыли пароль?
          </router-link>
          <p class="auth-footer-text">
            Нет аккаунта?
            <router-link to="/register" class="auth-link">
              Зарегистрироваться
            </router-link>
          </p>
        </div>
      </template>
    </AuthCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMutation } from '@vue/apollo-composable';
import { useAuthStore } from '@/stores/auth';
import { LOGIN } from '@/graphql/queries';
import { AuthCard, BaseInput, BaseButton } from '@/components/shared';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const errors = ref<{ email: string; password: string }>({ email: '', password: '' });
const isLoading = ref(false);

const loginMutation = useMutation(LOGIN);

function validateForm() {
  errors.value = { email: '', password: '' };
  let isValid = true;

  if (!email.value.trim()) {
    errors.value.email = 'Введите email';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    errors.value.email = 'Введите корректный email';
    isValid = false;
  }

  if (!password.value) {
    errors.value.password = 'Введите пароль';
    isValid = false;
  } else if (password.value.length < 6) {
    errors.value.password = 'Пароль должен содержать не менее 6 символов';
    isValid = false;
  }

  return isValid;
}

const isValid = computed(() => {
  // Preliminary validation for button state
  return email.value.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value) && password.value.length >= 6;
});

async function handleSubmit() {
  if (!validateForm()) {
    return;
  }

  isLoading.value = true;

  try {
    const result = await loginMutation.mutate({
      email: email.value.trim(),
      password: password.value,
    });

    if (result?.data?.login.success) {
      // Токены установлены в httpOnly cookies на сервере
      // Получаем userId через отдельный запрос после логина
      const { GET_USER } = await import('@/graphql/queries');
      const getUserModule = await import('@vue/apollo-composable');
      const getUserMutation = getUserModule.useMutation(GET_USER);

      // Сохраняем пользователя (id будет получен после получения данных пользователя)
      authStore.setAuth(
        { id: '', email: email.value.trim() },
        { accessToken: '', refreshToken: '', expiresIn: result.data.login.expiresIn || 3600 }
      );

      router.push('/dashboard');
    } else {
      const error = result?.data?.login.error;
      if (error) {
        if (error.code === 'USER_NOT_FOUND' || error.code === 'INVALID_PASSWORD') {
          errors.value.password = error.message;
        } else if (error.code === 'ACCOUNT_LOCKED') {
          errors.value.email = error.message;
        }
      }
    }
  } catch (error) {
    console.error('Login error:', error);
  } finally {
    isLoading.value = false;
  }
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

form {
  display: flex;
  flex-direction: column;
}

.auth-footer-text {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.auth-footer-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.auth-link {
  color: #6366f1;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: #4f46e5;
    text-decoration: underline;
  }
}
</style>
