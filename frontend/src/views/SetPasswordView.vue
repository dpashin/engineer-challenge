<template>
  <div class="auth-page">
    <AuthCard title="Задайте пароль">
      <p class="description">
        Напишите новый пароль, который будете использовать для входа
      </p>

      <form @submit.prevent="handleSubmit">
        <BaseInput
          v-model="password"
          type="password"
          label="Введите пароль"
          placeholder="Введите пароль"
          :error="errors.password"
          :disabled="isLoading"
        />

        <BaseInput
          v-model="passwordConfirm"
          type="password"
          label="Повторите пароль"
          placeholder="Повторите пароль"
          :error="errors.passwordConfirm"
          :disabled="isLoading"
        />

        <BaseButton
          type="submit"
          variant="primary"
          :loading="isLoading"
          :disabled="!isValid"
        >
          Изменить пароль
        </BaseButton>
      </form>
    </AuthCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMutation } from '@vue/apollo-composable';
import { RESET_PASSWORD } from '@/graphql/queries';
import { AuthCard, BaseInput, BaseButton } from '@/components/shared';

const router = useRouter();
const route = useRoute();

const password = ref('');
const passwordConfirm = ref('');
const errors = ref<{ password: string; passwordConfirm: string }>({
  password: '',
  passwordConfirm: '',
});
const isLoading = ref(false);

const { mutate: resetPasswordMutation } = useMutation(RESET_PASSWORD);

const isValid = computed(() => {
  return (
    password.value.length >= 8 &&
    password.value === passwordConfirm.value
  );
});

function validate() {
  errors.value = { password: '', passwordConfirm: '' };
  let isValid = true;

  if (!password.value) {
    errors.value.password = 'Введите пароль';
    isValid = false;
  } else if (password.value.length < 8) {
    errors.value.password = 'Пароль должен содержать минимум 8 символов';
    isValid = false;
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])/.test(password.value)) {
    errors.value.password = 'Пароль должен содержать заглавные и строчные буквы, цифру и спецсимвол';
    isValid = false;
  }

  if (password.value !== passwordConfirm.value) {
    errors.value.passwordConfirm = 'Пароли не совпадают';
    isValid = false;
  }

  return isValid;
}

async function handleSubmit() {
  if (!validate()) {
    return;
  }

  isLoading.value = true;

  const token = route.query.token as string;

  if (!token) {
    isLoading.value = false;
    return;
  }

  try {
    const result = await resetPasswordMutation({
      token,
      newPassword: password.value,
    });

    if (result?.data?.resetPassword.success) {
      router.push('/password-success');
    } else {
      const error = result?.data?.resetPassword.error;
      if (error) {
        if (error.code === 'INVALID_TOKEN') {
          router.push('/password-error');
        } else if (error.code === 'TOKEN_EXPIRED') {
          router.push('/password-error');
        } else if (error.code === 'TOKEN_ALREADY_USED') {
          router.push('/password-error');
        } else if (error.code === 'INVALID_PASSWORD') {
          errors.value.password = error.message;
        }
      }
    }
  } catch (error) {
    console.error('Reset password error:', error);
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

.description {
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
}
</style>
