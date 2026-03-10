# Auth BFF Service

Authentication Backends-For-Frontends (BFF) service built with NestJS, GraphQL, DDD, and CQRS.

## Architecture

This service follows Domain-Driven Design (DDD) and Command Query Responsibility Segregation (CQRS) patterns:

### Layers

- **Domain** (`src/domain/`) - Enterprise logic, entities, and business rules
  - `User` - User aggregate root
  - `PasswordResetToken` - Token entity with security policies
  - `PasswordPolicyService` - Password validation rules
  - `ResetTokenPolicyService` - Token expiration and rate limiting rules

- **Application** (`src/application/`) - Use cases, commands, queries, and handlers
  - Commands: `RegisterCommand`, `LoginCommand`, `RequestPasswordResetCommand`, `ResetPasswordCommand`
  - Queries: `GetUserQuery`
  - Handlers: Command and query handlers with CQRS

- **Infrastructure** (`src/infrastructure/`) - External adapters
  - Database: PostgreSQL connection and repositories
  - Services: Password hashing (bcrypt), JWT token service

- **Presentation** (`src/presentation/`) - GraphQL API layer
  - Resolvers: `AuthResolver` with mutations for auth flows
  - DTOs: GraphQL response types

## Features

### Authentication Flows

1. **Registration**
   - Email/password registration
   - Password policy validation (min 8 chars, uppercase, lowercase, digit, special char)
   - Duplicate email prevention

2. **Login**
   - JWT access and refresh tokens
   - Failed login attempt tracking
   - Account lockout protection

3. **Password Reset**
   - Cryptographically secure token generation
   - 10-minute token expiration
   - Single-use tokens
   - Rate limiting (3 attempts per 30 minutes)

### Security

- Passwords hashed with bcrypt (12 salt rounds)
- Reset tokens hashed with SHA-256 before storage
- JWT tokens for session management
- Rate limiting on password reset requests
- Account lockout after failed login attempts

## GraphQL API

### Mutations

```graphql
# Register a new user
mutation Register($email: String!, $password: String!) {
  register(email: $email, password: $password) {
    success
    userId
    email
    error {
      code
      message
    }
  }
}

# Login
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    success
    accessToken
    refreshToken
    expiresIn
    error {
      code
      message
    }
  }
}

# Request password reset
mutation RequestPasswordReset($email: String!) {
  requestPasswordReset(email: $email) {
    success
    token
    error {
      code
      message
    }
  }
}

# Reset password with token
mutation ResetPassword($token: String!, $newPassword: String!) {
  resetPassword(token: $token, newPassword: $newPassword) {
    success
    error {
      code
      message
    }
  }
}
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 17
- Docker & Docker Compose (optional)

### Local Development

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Update database credentials in `.env`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run database migrations (see `/db` directory)

5. Start development server:
   ```bash
   npm run start:dev
   ```

### Docker Compose

Start all services:
```bash
docker-compose up -d
```

Access GraphQL Playground at: http://localhost:3000/graphql

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

## Project Structure

```
src/
├── domain/                    # Domain layer
│   ├── user.entity.ts
│   ├── password-reset-token.entity.ts
│   ├── refresh-token.entity.ts
│   ├── password-policy.service.ts
│   └── reset-token-policy.service.ts
├── application/               # Application layer
│   ├── commands/             # Command definitions
│   ├── queries/              # Query definitions
│   └── handlers/             # Command/Query handlers
├── infrastructure/           # Infrastructure layer
│   ├── database/
│   ├── repositories/
│   └── services/
└── presentation/             # Presentation layer
    ├── graphql/
    └── dto/
```

## Business Rules

### Password Policy
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- At least one special character (!@#$%^&* etc.)

### Reset Token Policy
- 10-minute expiration
- Single-use (invalidated after use)
- Rate limiting: 3 failed attempts = 30-minute block
- Cryptographically secure generation (CSPRNG)
- SHA-256 hashing for storage
