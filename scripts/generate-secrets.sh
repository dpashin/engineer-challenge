#!/bin/bash
# =============================================================================
# Generate Secure Environment Secrets
# =============================================================================
# This script generates cryptographically secure random values for all secrets
# and creates a ready-to-use .env file from .env.example
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Generating secure environment variables...${NC}"

# Check if .env.example exists
if [ ! -f "$ENV_EXAMPLE" ]; then
    echo -e "${RED}Error: .env.example not found${NC}"
    exit 1
fi

# Check if .env already exists and ask for confirmation
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Warning: .env file already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Aborted${NC}"
        exit 0
    fi
fi

# Generate secure secrets using openssl
generate_secret() {
    openssl rand -base64 32
}

# Generate secrets
JWT_ACCESS_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)
DB_PASSWORD=$(generate_secret | tr -dc 'a-zA-Z0-9' | head -c 32)
SMTP_PASSWORD=$(generate_secret)

# Create .env from .env.example with generated secrets
cp "$ENV_EXAMPLE" "$ENV_FILE"

# Replace placeholders with generated secrets (using sed for macOS compatibility)
sed -i.bak "s|JWT_ACCESS_SECRET=CHANGE_ME_GENERATE_SECURE_SECRET|JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}|g" "$ENV_FILE"
sed -i.bak "s|JWT_REFRESH_SECRET=CHANGE_ME_GENERATE_SECURE_SECRET|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|g" "$ENV_FILE"
sed -i.bak "s|DB_PASSWORD=CHANGE_ME_GENERATE_SECURE_PASSWORD|DB_PASSWORD=${DB_PASSWORD}|g" "$ENV_FILE"
sed -i.bak "s|SMTP_PASSWORD=CHANGE_ME_GENERATE_SECURE_PASSWORD|SMTP_PASSWORD=${SMTP_PASSWORD}|g" "$ENV_FILE"

# Remove backup files created by sed
rm -f "$ENV_FILE.bak"

echo -e "${GREEN}✓ Secure .env file created at: ${ENV_FILE}${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "  - Store this file securely and never commit it to version control"
echo "  - For production, regenerate secrets and configure SMTP settings"
echo "  - Backup your secrets in a secure password manager"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Review the generated .env file"
echo "  2. Configure SMTP settings for production email delivery"
echo "  3. Run: docker-compose up -d"
