import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/check-email',
    name: 'check-email',
    component: () => import('@/views/CheckEmailView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/set-password',
    name: 'set-password',
    component: () => import('@/views/SetPasswordView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/password-success',
    name: 'password-success',
    component: () => import('@/views/PasswordSuccessView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/password-error',
    name: 'password-error',
    component: () => import('@/views/PasswordErrorView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  
  // Load auth state from storage if not already loaded
  if (!authStore.tokens && !authStore.user) {
    authStore.loadFromStorage();
  }

  const requiresAuth = to.meta.requiresAuth as boolean | undefined;
  const requiresGuest = to.meta.requiresGuest as boolean | undefined;

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (requiresGuest && authStore.isAuthenticated) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
