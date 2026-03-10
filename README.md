# Advanced Engineer Challenge

Не забудьте сперва поставить Star. Спасибо!

UPD: Вакансия немного переехала. Смотрите ссылку.

Этот репозиторий — инженерный челлендж для кандидатов на backend/fullstack позиции.

Задача специально узкая по продукту, но широкая по архитектуре: мы оцениваем не «как быстро собрать формы логина», а то, как вы проектируете систему.

## Контекст

Вам нужно реализовать модуль аутентификации для 3 пользовательских сценариев:
1. Регистрация
2. Авторизация
3. Восстановление пароля

UI-дизайн (https://www.figma.com/design/31KetUbya482vMSGgyiNIf/Orbitto-%7C-Service--Copy-?node-id=102-12806&t=TMlkJ3c3j3vJF5fb-4) уже подготовлен и будет отправной точкой для клиентской части.

## Что важно

Решение должно демонстрировать инженерную зрелость:
- [x] DDD (явные bounded context, модель домена, язык предметной области)
- [x] CQRS (разделение команд и запросов)
- [x] IaC (воспроизводимое окружение инфраструктуры)
- [x] Осознанный выбор языка и стека (язык выбираете на своё усмотрение, но выбор нужно аргументировать)

`CRUD + controller + stock REST auth по документации` не считается целевым уровнем решения для этого челленджа.

## Обязательные требования

1. Архитектура
- [ ] Покажите доменную модель и границы контекстов.
- [ ] Выделите command side и query side (даже если в упрощенном виде).
- [x] Опишите ключевые инварианты и бизнес-правила (например, правила reset-token, валидация пароля, ограничения на повторную отправку).
> [здесь](#бизнес-правила-и-ключевые-инварианты) 

2. API/протокол взаимодействия
- [x] Предпочтительный уровень: `gRPC` и/или `GraphQL`.
- [x] `Только REST` допустим исключительно при сильной архитектурной аргументации, иначе это будет существенным минусом.

3. Infrastructure as Code
- [x] Запуск окружения должен быть описан кодом.
- [x] Минимум: локально воспроизводимый стенд (например, Docker Compose).
> см. [Быстрый старт](#быстрый-старт)
- [ ] Плюс в оценке: Terraform/Kubernetes manifests/Helm.
> добавлен в [adr](./doc/adr/0006-prod-devops-platform.md) и [todo](#todo), нет времени протестировать корректность работы.

4. Безопасность
- [x] Без хранения паролей в открытом виде.
- [x] Корректная работа с токенами/сессиями.
- [ ] Защита базовых auth-флоу
    - [x] rate limiting
    > [здесь](#rate-limiting)
    - [x] expiration
    > [здесь](#токены)
    - [ ] replay/abuse considerations
    > [здесь](#refresh-token)

5. Наблюдаемость и качество
- [x] Логи, метрики или трейсинг (минимум один из блоков).
> Логи добавлены, метрики и tracing запланированы в [todo](#todo)
- [x] Тесты критичных участков (доменные правила, auth-флоу, интеграционные точки).
> см. [Запуск тестов](#запуск-тестов)

6. Технологические решения
- [x] Язык программирования и фреймворки выбираете самостоятельно.
- [x] В `README` обязательно зафиксируйте, почему выбрали именно этот стек и какие альтернативы рассматривали.
> см. [ADR](./doc/adr/)

## Ограничения и анти-паттерны

Следующие подходы считаются слабым решением:
- Полностью «коробочный» auth-провайдер без вашей архитектурной проработки домена.
- Копирование шаблонного туториала без обоснования trade-offs.
- Монолитный слой handlers/controllers без разделения доменной и инфраструктурной логики.

Можно использовать библиотеки для криптографии, JWT, транспорта и т.д., но архитектурные решения должны быть вашими.

## Что нужно сдать

- [x] 1. Исходный код в вашем fork.
- [x] 2. Обновленный `README` в вашем fork с:
- [x] как запустить проект;
> см. [Быстрый старт](#быстрый-старт)
- [x] архитектурная схема (можно Mermaid/PlantUML);
> [здесь](#архитектура)
- [ ] объяснение, где в решении DDD, CQRS и IaC;
- [x] ключевые компромиссы (trade-offs);
- [x] что сделали бы следующим шагом в production-версии.
> [здесь](#todo)
- [x] 3. Минимальный набор тестов и инструкции по их запуску.
> см. [Запуск тестов](#запуск-тестов)

## Формат выполнения

1. Сделайте fork этого репозитория.
2. Пройдите Pinterest-челлендж:
- соберите `moodboard`;
- соберите `anti-moodboard`.
3. Реализуйте решение в своем fork.
4. Оформите результат в `README`.
5. Отправьте 3 ссылки в отклике:
- ссылка на `moodboard`;
- ссылка на `anti-moodboard`;
- ссылка на ваш fork.

## Использование ИИ

- [x] Использование ИИ-инструментов в рамках челленджа разрешено.
- [x] Если используете ИИ, добавьте в ваш fork папку `.agents`, чтобы было видно, каким образом вы строили процесс решения.

## Критерии оценки

1. Архитектурное мышление (DDD/CQRS/IaC).
2. Качество инженерных решений и аргументация trade-offs.
3. Надежность и безопасность auth-флоу.
4. Чистота кода и тестовое покрытие критичных сценариев.
5. Операбельность: насколько легко поднять и проверить решение.

## Бонусные сигналы

- Event-driven взаимодействие между компонентами.
- Service mesh / policy-driven networking (если уместно и обосновано).
- Продуманная стратегия эволюции схемы данных и backward compatibility.
- ADR (Architecture Decision Records) для ключевых решений.

## Важно

Нас интересует не «идеальный продакшен за вечер», а качество инженерного мышления и способность строить систему осознанно.

---

# Реализация

## Архитектура

[System context diagram](./doc/system-context.mmd)

[Записи архитектурных решений](./doc/adr/)

## Технологии

### Backend
- **NestJS** - Node.js фреймворк с поддержкой DDD/CQRS
- **GraphQL (Apollo)** - API слой
- **PostgreSQL** - Реляционная БД
- **TypeScript** - Типизация
- **CQRS (@nestjs/cqrs)** - Разделение команд и запросов
- **Redis (ioredis)** - Rate limiting (sliding window log)

### Frontend
- **Vue.js 3** - Composition API
- **TypeScript** - Типизация
- **Pinia** - Управление состоянием
- **Vue Router** - Маршрутизация
- **Apollo Client** - GraphQL клиент
- **Bootstrap 5** - Стилизация
- **Vite** - Сборка

### Infrastructure
- **Docker & Docker Compose** - Контейнеризация
- **PostgreSQL 17** - База данных
- **Redis 7** - Rate limiting (sliding window log)
- **Mailcatcher** - Тестовый SMTP сервер
- **Nginx** - Reverse proxy для frontend

## Структура проекта

```
engineer-challenge/
├── backend/
│   └── auth-service/       # NestJS GraphQL API с DDD/CQRS
│       ├── src/
│       │   ├── domain/         # Доменная модель
│       │   ├── application/    # Команды, запросы, обработчики
│       │   ├── infrastructure/ # Репозитории, сервисы
│       │   └── presentation/   # GraphQL резолверы, DTO
│       └── ...
├── frontend/               # Vue.js 3 + TypeScript
│   ├── src/
│   │   ├── components/       # UI компоненты
│   │   ├── views/            # Страницы
│   │   ├── stores/           # Pinia хранилища
│   │   ├── router/           # Маршрутизация
│   │   └── graphql/          # GraphQL запросы
│   └── ...
├── db/                     # SQL скрипты для БД
├── doc/                    # Документация
├── docker-compose.yml      # Оркестрация сервисов
└── ...
```


## Быстрый старт

### Генерация безопасных секретов

**Важно:** Перед запуском необходимо сгенерировать криптографически стойкие секреты!

```bash
# Автоматическая генерация всех секретов
./scripts/generate-secrets.sh

# Или вручную для каждого секрета:
openssl rand -base64 32  # JWT_ACCESS_SECRET
openssl rand -base64 32  # JWT_REFRESH_SECRET
openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32  # DB_PASSWORD
```

### Запуск всего приложения

```bash
# Клонировать репозиторий
git clone -b dev git@github.com:dpashin/engineer-challenge.git
cd engineer-challenge

# Сгенерировать секреты (если ещё не сделали)
./scripts/generate-secrets.sh

# Запустить все сервисы
docker-compose up -d --build

# Проверить статус
docker-compose ps
```

После запуска:
- **Frontend**: http://localhost:4200
- **GraphQL API**: http://localhost:3000/graphql
- **Mailcatcher**: http://localhost:1080 (для просмотра писем)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Остановка приложения

```bash
docker-compose down
```

### Запуск тестов

```bash
docker build --target dev -t auth-service-dev ./backend/auth-service && docker run --rm auth-service-dev npm run test:dev
```

### Production Deployment

Для production окружения используйте отдельный compose файл с hardened настройками:

```bash
# 1. Сгенерируйте безопасные секреты (если ещё не сделали)
./scripts/generate-secrets.sh

# 2. Проверьте .env файл и настройте SMTP для production
# Отредактируйте SMTP_HOST, SMTP_USER, SMTP_PASSWORD для реального почтового сервера

# 3. Запустите production стек
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Проверьте статус
docker-compose ps
```

**Production отличия:**
- `NODE_ENV=production`
- Все секреты через environment variables (обязательные переменные помечены `?` в compose файле)
- Mailcatcher исключён (используйте реальный SMTP)
- Health checks для всех сервисов
- `restart: always` для авто-восстановления
- Нет hardcoded secrets в docker-compose файлах

### Безопасность

**Критические требования:**
- ✅ Никогда не коммитьте `.env` файл в git (добавлен в `.gitignore`)
- ✅ Генерируйте уникальные секреты для каждого развёртывания
- ✅ Используйте HTTPS в production (настройте reverse proxy с SSL)
- ✅ Регулярно обновляйте зависимости (`npm audit`, `npm audit fix`)
- ✅ Ротируйте секреты периодически (минимум раз в 90 дней)

#### Токены и Cookies

**httpOnly Cookies:**
- Токены хранятся в httpOnly cookies для защиты от XSS атак
- Cookies устанавливаются с флагами: `httpOnly`, `secure` (в production), `sameSite=lax`
- Access token: 1 час, Refresh token: 7 дней
- Refresh token автоматически обновляется при истечении access token

**Защита от XSS:**
- Токены не доступны через JavaScript (httpOnly)
- Frontend не хранит чувствительные данные в localStorage
- Cookies передаются только по HTTPS в production

## Бизнес-правила и ключевые инварианты

### Бизнес-процессы
- [Регистрация](./doc/sequence-diagrams-registration.mmd)
- [Аутентификация](./doc/sequence-diagrams-login.mmd)
- [Восстановление пароля](./doc/sequence-diagrams-recovery.mmd)

### Токены

#### Access Token
- Algorithm: JWT with HMAC SHA-256
- Expiration: JWT_ACCESS_EXPIRES_IN = 3600 seconds (1 hour)
- Configurable via: .env variable JWT_ACCESS_EXPIRES_IN
- Payload: Contains sub (userId), email, iat (issued at), exp (expiration)

#### Refresh Token
- Algorithm: JWT with HMAC SHA-256
- Expiration: JWT_REFRESH_EXPIRES_IN = 604800 seconds (7 days)
- Configurable via: .env variable JWT_REFRESH_EXPIRES_IN
- Storage: Stored in database (refresh_tokens table) with expires_at column
- Features: Supports revocation (single logout or all tokens)
- **Replay Attack Protection**:
  - Each token contains unique `jti` (JWT ID) claim for identification
  - Atomic token rotation: old token revoked BEFORE new tokens generated
  - Database constraint: UNIQUE INDEX on `jti` prevents duplicate usage
  - Fingerprint validation: IP address and User Agent are compared with original session
  - Concurrent request handling: Second simultaneous request is rejected as replay attack

#### Password Reset Token
- Expiration: 10 minutes (hardcoded in ResetTokenPolicyService)
- Single-use: Token invalidated after use
- Rate limiting: Max 3 attempts per 30 minute

#### Пароль
1. Минимальная длина: 8 символов.
2. Разнообразие символов: Требование использовать минимум по одному символу из разных групп:
- Заглавные буквы (A-Z).
- Строчные буквы (a-z).
- Цифры (0-9).
- Специальные символы (!, @, #, $, % и др.).
3. В базе следует хранить не сам пароль, а его хэш.

### Rate limiting

Rate limiting реализован с использованием **Redis** и алгоритма **Sliding Window Log**.

см. [ADR](./doc/adr/0008-rate-limiting.md)

- **LOGIN_BY_EMAIL** — ограничение неудачных попыток входа по email
- **LOGIN_BY_IP** — ограничение по IP адресу
- **REGISTER_BY_EMAIL** — ограничение регистраций по email
- **REGISTER_BY_IP** — ограничение регистраций по IP
- **PASSWORD_RESET_BY_EMAIL** — ограничение запросов сброса пароля
- **PASSWORD_RESET_BY_IP** — ограничение по IP для сброса пароля
- **TOKEN_REFRESH** — ограничение refresh token запросов
- **API_GLOBAL** — глобальное ограничение API

### Очистка устаревших данных

Следующие устаревшие сущности должны удаляться по крону через неделю после того, как у них истек срок действия:
- password_reset_tokens
- refresh_tokens

Поддержка горизонтального масштабирования (Если бэкэнд развернут на нескольких инстансах, не должно возникать конфликтов в крон-задачах).

## TODO

- [ ] красивые миграции в базе (dbmate?, ...)
- [ ] Terraform/Kubernetes manifests/Helm
- [ ] Метрики (prometheus), трейсинг (подумать)
- [x] подумать на предмет замены localstorage на куки
- [ ] еще раз прочекать twelve-factor, что-то оставалось
- [x] прочекать на уязвимости
- [x] Исправить уязвимости в зависимостях (nodemailer, bcrypt)
- [x] Удалить hardcoded секреты из docker-compose.yml
- [ ] Посчитать покрытие юнит-тестами
- [ ] Логин - валидация пароля сообщение на английском
- [ ] Проверить, как бэк отдает health статус
- [ ] hot rebuild для дев среды



