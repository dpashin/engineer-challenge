# Frontend - Vue.js Authentication Application

Frontend-приложение для модуля аутентификации, реализованное на Vue.js 3 с использованием Composition API, TypeScript, Pinia для управления состоянием, Vue Router для навигации и Apollo Client для работы с GraphQL.

## Технологический стек

- **Vue.js 3** - прогрессивный JavaScript-фреймворк с Composition API
- **TypeScript** - типизация JavaScript для улучшения качества кода
- **Pinia** - официальное хранилище состояний для Vue.js
- **Vue Router** - официальный маршрутизатор для Vue.js
- **Apollo Client (@vue/apollo-composable)** - GraphQL клиент с Vue 3 композиционными функциями
- **Bootstrap 5** - CSS-фреймворк для стилизации
- **Vite** - современный сборщик проектов
- **SCSS** - CSS-препроцессор для написания стилей

## Структура проекта

```
frontend/
├── src/
│   ├── components/
│   │   └── shared/           # Переиспользуемые UI-компоненты
│   │       ├── AuthCard.vue  # Карточка для экранов авторизации
│   │       ├── BaseInput.vue # Поле ввода
│   │       ├── BaseButton.vue # Кнопка
│   │       └── index.ts
│   ├── graphql/
│   │   ├── apollo.ts         # Конфигурация Apollo Client
│   │   └── queries.ts        # GraphQL запросы и мутации
│   ├── router/
│   │   └── index.ts          # Конфигурация маршрутизации
│   ├── stores/
│   │   └── auth.ts           # Pinia store для аутентификации
│   ├── views/                # Страничные компоненты
│   │   ├── LoginView.vue          # Экран входа
│   │   ├── RegisterView.vue       # Экран регистрации
│   │   ├── ForgotPasswordView.vue # Экран восстановления пароля
│   │   ├── CheckEmailView.vue     # Экран "Проверьте почту"
│   │   ├── SetPasswordView.vue    # Экран установки нового пароля
│   │   ├── PasswordSuccessView.vue # Экран успешного восстановления
│   │   ├── PasswordErrorView.vue   # Экран ошибки восстановления
│   │   └── DashboardView.vue       # Личный кабинет
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── Dockerfile
├── nginx.conf
├── .env
└── package.json
```

## Экраны приложения

### 1. Вход в систему (`/login`)
- Поле ввода email
- Поле ввода пароля
- Кнопка "Войти"
- Кнопка "Забыли пароль?" (переход на восстановление)
- Ссылка на регистрацию

### 2. Регистрация (`/register`)
- Поле ввода email
- Поле ввода пароля
- Поле подтверждения пароля
- Кнопка "Зарегистрироваться"
- Текст о принятии условий оферты

### 3. Восстановление пароля
- **`/forgot-password`** - Ввод email для отправки ссылки
- **`/check-email`** - Подтверждение отправки письма
- **`/set-password?token=...`** - Установка нового пароля
- **`/password-success`** - Успешное восстановление
- **`/password-error`** - Ошибка восстановления

### 4. Личный кабинет (`/dashboard`)
- Приветствие пользователя
- Кнопка выхода

## Запуск приложения

### Локальная разработка

```bash
cd frontend
npm install
npm run dev
```

Приложение будет доступно по адресу: http://localhost:5173

### Сборка для production

```bash
npm run build
```

### Запуск в Docker

```bash
# Из корня проекта
docker-compose up --build frontend
```

Приложение будет доступно по адресу: http://localhost:4200

## Переменные окружения

Создайте файл `.env` в папке `frontend/`:

```env
VITE_GRAPHQL_ENDPOINT=http://localhost:3000/graphql
```

## GraphQL API

Приложение взаимодействует с backend через GraphQL мутации:

### Register
```graphql
mutation Register($email: String!, $password: String!) {
  register(email: $email, password: $password) {
    success
    userId
    email
    error { code message }
  }
}
```

### Login
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    success
    accessToken
    refreshToken
    expiresIn
    error { code message }
  }
}
```

### RequestPasswordReset
```graphql
mutation RequestPasswordReset($email: String!) {
  requestPasswordReset(email: $email) {
    success
    token
    error { code message }
  }
}
```

### ResetPassword
```graphql
mutation ResetPassword($token: String!, $newPassword: String!) {
  resetPassword(token: $token, newPassword: $newPassword) {
    success
    error { code message }
  }
}
```

## Архитектурные решения

### Управление состоянием (Pinia)
- `auth` store хранит информацию о пользователе и токенах
- Токены сохраняются в localStorage для персистентности между перезагрузками
- Автоматическая загрузка состояния при инициализации

### Маршрутизация (Vue Router)
- Guard'ы для защиты маршрутов (`requiresAuth`, `requiresGuest`)
- Ленивая загрузка компонентов для оптимизации размера бандла

### GraphQL (Apollo Client)
- Использование `@vue/apollo-composable` для интеграции с Vue 3
- Мутации выполняются через `useMutation` хук
- Отключение кэширования для мутаций и запросов аутентификации

### Валидация форм
- Клиентская валидация перед отправкой на сервер
- Валидация email формата
- Требования к паролю (минимум 8 символов, заглавные, строчные буквы, цифры, спецсимволы)
- Проверка совпадения паролей

### Стилизация
- Градиентный фон для всех экранов аутентификации
- Единый компонент `AuthCard` для консистентности
- Адаптивный дизайн для мобильных устройств
- SCSS для модульности стилей

## Безопасность

- Пароли не сохраняются в localStorage
- Токены хранятся в localStorage (для production рекомендуется использовать httpOnly cookies)
- Валидация на клиенте и сервере
- Обработка ошибок GraphQL
