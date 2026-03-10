# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Test stage
FROM node:20-alpine AS test

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY src ./src
COPY tsconfig.json ./
COPY jest.config.js ./

# Run tests
CMD ["npm", "test"]

# Dev stage - for running tests with dev dependencies
FROM node:20-alpine AS dev

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY src ./src
COPY tsconfig.json ./
COPY jest.config.js ./

# Default command for dev stage
CMD ["npm", "run", "test:dev"]

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/graphql || exit 1

# Start the application
CMD ["node", "dist/main.js"]
