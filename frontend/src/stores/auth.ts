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

  function setAuth(newUser: User, newTokens: AuthTokens) {
    user.value = newUser;
    tokens.value = newTokens;
    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  }

  function loadFromStorage() {
    const storedTokens = localStorage.getItem('auth_tokens');
    const storedUser = localStorage.getItem('auth_user');

    if (storedTokens) {
      tokens.value = JSON.parse(storedTokens);
    }

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
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
  }

  function updateTokens(newAccessToken: string, newRefreshToken: string) {
    if (tokens.value) {
      tokens.value.accessToken = newAccessToken;
      tokens.value.refreshToken = newRefreshToken;
      localStorage.setItem('auth_tokens', JSON.stringify(tokens.value));
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
