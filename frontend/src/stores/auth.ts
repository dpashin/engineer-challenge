import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { setAuthStore } from '../graphql/apollo';

interface User {
  id: string;
  email: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const tokens = ref<AuthTokens | null>(null);
  const isAuthenticated = computed(() => !!tokens.value && !!user.value);

  /**
   * Устанавливаем аутентификацию
   * Токены теперь хранятся в httpOnly cookies, а не в localStorage
   */
  function setAuth(newUser: User, newTokens: AuthTokens) {
    user.value = newUser;
    tokens.value = newTokens;
    // Токены больше не сохраняем в localStorage - они в httpOnly cookies
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  }

  function loadFromStorage() {
    // Токены загружаются автоматически из cookies
    const storedUser = localStorage.getItem('auth_user');

    if (storedUser) {
      user.value = JSON.parse(storedUser);
    }

    // Initialize auth store in apollo for token refresh
    setAuthStore({
      tokens: tokens,
      logout: logout,
      updateTokens: updateTokens,
    });
  }

  function logout() {
    user.value = null;
    tokens.value = null;
    // Cookies очищаются на сервере при вызове logout мутации
    localStorage.removeItem('auth_user');
  }

  function updateTokens(newAccessToken: string, newRefreshToken: string) {
    if (tokens.value) {
      tokens.value.accessToken = newAccessToken;
      tokens.value.refreshToken = newRefreshToken;
      // Токены не сохраняем в localStorage - они в httpOnly cookies
    }
  }

  return {
    user,
    tokens,
    isAuthenticated,
    setAuth,
    loadFromStorage,
    logout,
    updateTokens,
  };
});
