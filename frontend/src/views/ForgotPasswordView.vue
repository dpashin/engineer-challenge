<template>
  <div class="auth-page">
    <AuthCard title="Восстановление пароля">
      <form @submit.prevent="handleSubmit">
        <p class="description">
          Введите email, указанный при регистрации. Мы отправим вам ссылку для
          восстановления пароля.
        </p>

        <BaseInput
          v-model="email"
          type="email"
          label="E-mail"
          placeholder="Введите email"
          :error="errors.email"
          :disabled="isLoading"
        />

        <BaseButton
          type="submit"
          variant="primary"
          :loading="isLoading"
          :disabled="!isValid"
        >
          Отправить ссылку
        </BaseButton>
      </form>

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
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMutation } from '@vue/apollo-composable';
import { REQUEST_PASSWORD_RESET } from '@/graphql/queries';
import { AuthCard, BaseInput, BaseButton } from '@/components/shared';

const router = useRouter();

const email = ref('');
const errors = ref<{ email: string }>({ email: '' });
const isLoading = ref(false);

const { mutate: requestPasswordResetMutation } = useMutation(REQUEST_PASSWORD_RESET);

const isValid = computed(() => {
  return email.value.trim() !== '';
});

function validate() {
  errors.value = { email: '' };
  let isValid = true;

  if (!email.value.trim()) {
    errors.value.email = 'Введите email';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    errors.value.email = 'Введите корректный email';
    isValid = false;
  }

  return isValid;
}

async function handleSubmit() {
  if (!validate()) {
    return;
  }

  isLoading.value = true;

  try {
    const result = await requestPasswordResetMutation({
      email: email.value.trim(),
    });

    if (result?.data?.requestPasswordReset.success) {
      router.push('/check-email');
    } else {
      const error = result?.data?.requestPasswordReset.error;
      if (error) {
        if (error.code === 'RATE_LIMITED') {
          errors.value.email = error.message;
        }
      }
    }
  } catch (error) {
    console.error('Request password reset error:', error);
  } finally {
    isLoading.value = false;
  }
}

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

form {
  display: flex;
  flex-direction: column;
}

.description {
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
}
</style>
