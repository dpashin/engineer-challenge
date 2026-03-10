# How to Test GraphQL Calls Manually from a Browser

1. Start the Services
```bash
docker-compose up
```

This starts:

PostgreSQL on localhost:5432
Auth service on localhost:3000

2. Access Apollo Playground
Open your browser and navigate to:

http://localhost:3000/graphql
Since NODE_ENV=development (see docker-compose.yml), the Apollo Playground is enabled (see app.module.ts):

playground: process.env.NODE_ENV !== 'production',
introspection: process.env.NODE_ENV !== 'production',

3. Available GraphQL Operations

3.1. Health Check (Query):
```graphql
query {
  health
}
```

3.2. Register (Mutation):
```graphql
mutation {
  register(email: "test@example.com", password: "Pass123!") {
    success
    userId
    email
    error {
      code
      message
    }
  }
}
```

3.3 Login (Mutation):
```graphql
mutation {
  login(email: "test@example.com", password: "Pass123!") {
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
```

3.4. Request Password Reset (Mutation):
```graphql
mutation {
  requestPasswordReset(email: "test@example.com") {
    success
    token
    error {
      code
      message
    }
  }
}
```

3.5. Reset Password (Mutation):
```graphql
mutation {
  resetPassword(token: "your-token-here", newPassword: "NewPass123!") {
    success
    error {
      code
      message
    }
  }
}
```