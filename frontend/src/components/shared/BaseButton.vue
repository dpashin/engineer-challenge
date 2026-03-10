<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="['btn', variant, { 'btn-loading': loading }]"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="btn-spinner"></span>
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
interface Props {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'link';
  disabled?: boolean;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  disabled: false,
  loading: false,
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<style lang="scss" scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  text-decoration: none;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  &.btn-loading {
    pointer-events: none;
  }
}

.btn-primary {
  color: #fff;
  background-color: #6366f1;

  &:hover:not(:disabled) {
    background-color: #4f46e5;
  }

  &:active:not(:disabled) {
    background-color: #4338ca;
  }
}

.btn-secondary {
  color: #374151;
  background-color: #f3f4f6;

  &:hover:not(:disabled) {
    background-color: #e5e7eb;
  }

  &:active:not(:disabled) {
    background-color: #d1d5db;
  }
}

.btn-link {
  color: #6366f1;
  background: transparent;
  padding: 0;

  &:hover:not(:disabled) {
    color: #4f46e5;
    text-decoration: underline;
  }
}

.btn-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
