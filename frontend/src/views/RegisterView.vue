<template>
  <div class="auth-page">
    <AuthCard title="Регистрация">
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
          Зарегистрироваться
        </BaseButton>

        <p class="terms-text">
          Зарегистрировавшись, пользователь принимает условия договора оферты и
          политики конфиденциальности
        </p>
      </form>

      <template #footer>
        <p class="auth-footer-text">
          Уже есть аккаунт?
          <router-link to="/login" class="auth-link">
            Войти
          </router-link>
        </p>
      </template>
    </AuthCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMutation } from '@vue/apollo-composable';
import { REGISTER } from '@/graphql/queries';
import { AuthCard, BaseInput, BaseButton } from '@/components/shared';

const router = useRouter();

const email = ref('');
const password = ref('');
const passwordConfirm = ref('');
const errors = ref<{ email: string; password: string; passwordConfirm: string }>({
  email: '',
  password: '',
  passwordConfirm: '',
});
const isLoading = ref(false);
const generalError = ref('');

const { mutate: registerMutation } = useMutation(REGISTER);

const isValid = computed(() => {
  return (
    email.value.trim() !== '' &&
    password.value.length >= 8 &&
    password.value === passwordConfirm.value
  );
});

function validate() {
  errors.value = { email: '', password: '', passwordConfirm: '' };
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
  generalError.value = '';

  try {
    const result = await registerMutation({
      email: email.value.trim(),
      password: password.value,
    });

    if (result?.data?.register.success) {
      router.push('/login?registered=true');
    } else {
      const error = result?.data?.register.error;
      if (error) {
        generalError.value = error.message || 'Ошибка регистрации';
        
        if (error.code === 'EMAIL_ALREADY_EXISTS') {
          errors.value.email = error.message;
        } else if (error.code === 'INVALID_PASSWORD') {
          errors.value.password = error.message;
        }
      }
    }
  } catch (error) {
    console.error('Register error:', error);
    generalError.value = 'Ошибка подключения к серверу';
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

.terms-text {
  margin-top: 1rem;
  font-size: 0.75rem;
  color: #9ca3af;
  line-height: 1.4;
  text-align: center;
}

.auth-footer-text {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
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
