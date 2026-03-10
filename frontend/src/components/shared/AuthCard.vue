<template>
  <div class="auth-card">
    <div class="auth-header">
      <slot name="header">
        <h1 class="auth-title">{{ title }}</h1>
      </slot>
    </div>
    <div class="auth-body">
      <slot></slot>
    </div>
    <div class="auth-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
}

withDefaults(defineProps<Props>(), {
  title: '',
});
</script>

<style lang="scss" scoped>
.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
  background-color: #fff;
  border-radius: 1rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.auth-header {
  margin-bottom: 2rem;
  text-align: center;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.auth-body {
  margin-bottom: 1.5rem;
}

.auth-footer {
  text-align: center;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}
</style>
