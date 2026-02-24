#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Opencom Self-Host Setup Script                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ADMIN_NAME=""
WORKSPACE_NAME=""
SKIP_DEV_SERVER=false
NON_INTERACTIVE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --email)
      ADMIN_EMAIL="$2"
      shift 2
      ;;
    --password)
      ADMIN_PASSWORD="$2"
      shift 2
      ;;
    --name)
      ADMIN_NAME="$2"
      shift 2
      ;;
    --workspace)
      WORKSPACE_NAME="$2"
      shift 2
      ;;
    --skip-dev)
      SKIP_DEV_SERVER=true
      shift
      ;;
    --non-interactive)
      NON_INTERACTIVE=true
      shift
      ;;
    -h|--help)
      echo "Usage: ./setup.sh [options]"
      echo ""
      echo "Options:"
      echo "  --email EMAIL        Admin email address"
      echo "  --password PASSWORD  Admin password"
      echo "  --name NAME          Admin display name"
      echo "  --workspace NAME     Workspace name (default: My Workspace)"
      echo "  --skip-dev           Skip starting dev servers"
      echo "  --non-interactive    Run without prompts (requires --email and --password)"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Function to check command exists
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}Error: $1 is not installed${NC}"
    return 1
  fi
  return 0
}

# Function to check version
check_version() {
  local cmd=$1
  local required=$2
  local current

  if [ "$cmd" = "node" ]; then
    current=$(node -v | sed 's/v//' | cut -d. -f1)
  elif [ "$cmd" = "pnpm" ]; then
    current=$(pnpm -v | cut -d. -f1)
  fi

  if [ "$current" -lt "$required" ]; then
    echo -e "${RED}Error: $cmd version $required+ required, found $current${NC}"
    return 1
  fi
  return 0
}

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/8] Checking prerequisites...${NC}"

if ! check_command "node"; then
  echo -e "${RED}Please install Node.js 18+ from https://nodejs.org${NC}"
  exit 1
fi

if ! check_version "node" 18; then
  echo -e "${RED}Please upgrade Node.js to version 18+${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

if ! check_command "pnpm"; then
  echo -e "${RED}Please install pnpm: npm install -g pnpm${NC}"
  exit 1
fi

if ! check_version "pnpm" 9; then
  echo -e "${YELLOW}Warning: pnpm 9+ recommended, found $(pnpm -v)${NC}"
fi
echo -e "  ${GREEN}✓${NC} pnpm $(pnpm -v)"

# Step 2: Install dependencies
echo ""
echo -e "${YELLOW}[2/8] Installing dependencies...${NC}"
cd "$ROOT_DIR"
pnpm install

# Step 3: Check Convex login
echo ""
echo -e "${YELLOW}[3/8] Checking Convex authentication...${NC}"
cd "$ROOT_DIR/packages/convex"

if ! npx convex whoami &> /dev/null; then
  echo -e "${YELLOW}You need to log in to Convex.${NC}"
  echo -e "Running: npx convex login"
  npx convex login
fi
echo -e "  ${GREEN}✓${NC} Logged in to Convex"

# Step 4: Deploy Convex
echo ""
echo -e "${YELLOW}[4/8] Setting up Convex project...${NC}"

# Generate a unique project name
PROJECT_NAME="opencom-$(date +%s | tail -c 6)"

# Run convex dev --once and capture output
echo -e "Creating Convex project: ${PROJECT_NAME}"
CONVEX_OUTPUT=$(npx convex dev --once --project "$PROJECT_NAME" 2>&1) || true

# Extract the deployment URL
CONVEX_URL=$(echo "$CONVEX_OUTPUT" | grep -oE 'https://[a-zA-Z0-9-]+\.convex\.cloud' | head -1)

if [ -z "$CONVEX_URL" ]; then
  # Try to get it from .env.local if it was created
  if [ -f ".env.local" ]; then
    CONVEX_URL=$(grep "CONVEX_DEPLOYMENT" .env.local | cut -d'=' -f2 | sed 's/"//g')
    if [ -z "$CONVEX_URL" ]; then
      CONVEX_URL=$(grep "NEXT_PUBLIC_CONVEX_URL" .env.local | cut -d'=' -f2 | sed 's/"//g')
    fi
  fi
fi

if [ -z "$CONVEX_URL" ]; then
  echo -e "${RED}Could not determine Convex deployment URL${NC}"
  echo "Please check if the deployment succeeded and try again."
  echo "Output was: $CONVEX_OUTPUT"
  exit 1
fi

echo -e "  ${GREEN}✓${NC} Convex deployed: $CONVEX_URL"

# Step 5: Generate and set AUTH_SECRET
echo ""
echo -e "${YELLOW}[5/8] Setting up environment variables...${NC}"

# Generate AUTH_SECRET
if command -v openssl &> /dev/null; then
  AUTH_SECRET=$(openssl rand -base64 32)
else
  # Fallback to Node.js
  AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
fi

echo -e "  ${GREEN}✓${NC} Generated AUTH_SECRET"

# Set AUTH_SECRET in Convex
echo "Setting AUTH_SECRET in Convex environment..."
npx convex env set AUTH_SECRET "$AUTH_SECRET" 2>/dev/null || echo -e "${YELLOW}Note: Could not set AUTH_SECRET automatically. Please set it manually in Convex dashboard.${NC}"

# Set SITE_URL for Convex Auth (required for OTP email verification)
echo "Setting SITE_URL in Convex environment..."
npx convex env set SITE_URL "http://localhost:3000" 2>/dev/null || echo -e "${YELLOW}Note: Could not set SITE_URL automatically. Please set it manually in Convex dashboard.${NC}"
echo -e "${YELLOW}Note: Update SITE_URL in Convex dashboard when deploying to production.${NC}"

# Step 6: Get admin credentials
echo ""
echo -e "${YELLOW}[6/8] Creating admin account...${NC}"

if [ -z "$ADMIN_EMAIL" ]; then
  if [ "$NON_INTERACTIVE" = true ]; then
    echo -e "${RED}Error: --email required in non-interactive mode${NC}"
    exit 1
  fi
  read -p "Enter admin email: " ADMIN_EMAIL
fi

if [ -z "$ADMIN_PASSWORD" ]; then
  if [ "$NON_INTERACTIVE" = true ]; then
    echo -e "${RED}Error: --password required in non-interactive mode${NC}"
    exit 1
  fi
  read -s -p "Enter admin password: " ADMIN_PASSWORD
  echo ""
fi

if [ -z "$ADMIN_NAME" ]; then
  ADMIN_NAME="${ADMIN_EMAIL%%@*}"
fi

if [ -z "$WORKSPACE_NAME" ]; then
  WORKSPACE_NAME="My Workspace"
fi

# Step 7: Create admin account via auth:signup
echo ""
echo -e "${YELLOW}[7/8] Creating workspace and admin user...${NC}"

# Check if setup has already been done
EXISTING_SETUP=$(npx convex run setup:checkExistingSetup '{}' 2>&1) || true

if echo "$EXISTING_SETUP" | grep -q '"hasUsers":true'; then
  echo -e "${YELLOW}Note: Users already exist in this Convex deployment.${NC}"
  echo -e "${YELLOW}Attempting to create new admin account anyway...${NC}"
fi

# Use the existing auth:signup mutation (same code path as normal signup)
SIGNUP_ARGS="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"name\":\"$ADMIN_NAME\",\"workspaceName\":\"$WORKSPACE_NAME\"}"

SIGNUP_RESULT=$(npx convex run auth:signup "$SIGNUP_ARGS" 2>&1) || true

# Parse the workspace ID from the user object in the result
WORKSPACE_ID=$(echo "$SIGNUP_RESULT" | grep -oE '"workspaceId":\s*"[^"]+"' | sed 's/"workspaceId":\s*"//' | sed 's/"$//' | head -1)

if [ -z "$WORKSPACE_ID" ]; then
  # Try alternate parsing for Convex IDs
  WORKSPACE_ID=$(echo "$SIGNUP_RESULT" | grep -oE '[a-z0-9]{32}' | head -1)
fi

if echo "$SIGNUP_RESULT" | grep -q 'already exists'; then
  echo -e "${RED}Error: User with email $ADMIN_EMAIL already exists${NC}"
  echo -e "${YELLOW}You can log in with this email on the web dashboard.${NC}"
  echo -e "${YELLOW}To get the workspace ID, check the Convex dashboard or web app settings.${NC}"
  WORKSPACE_ID="YOUR_WORKSPACE_ID"
fi

if [ -z "$WORKSPACE_ID" ] || [ "$WORKSPACE_ID" = "YOUR_WORKSPACE_ID" ]; then
  echo -e "${YELLOW}Warning: Could not parse workspace ID from signup result.${NC}"
  echo -e "${YELLOW}You may need to get it from Convex dashboard or web app settings.${NC}"
  WORKSPACE_ID="YOUR_WORKSPACE_ID"
else
  echo -e "  ${GREEN}✓${NC} Workspace created: $WORKSPACE_ID"
  echo -e "  ${GREEN}✓${NC} Admin user created: $ADMIN_EMAIL"
fi

# Step 8: Generate .env.local files
echo ""
echo -e "${YELLOW}[8/8] Generating environment files...${NC}"

cd "$ROOT_DIR"

# apps/web/.env.local
cat > apps/web/.env.local << EOF
NEXT_PUBLIC_CONVEX_URL=$CONVEX_URL
NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL=$CONVEX_URL
EOF
echo -e "  ${GREEN}✓${NC} Created apps/web/.env.local"

# apps/widget/.env.local
cat > apps/widget/.env.local << EOF
VITE_CONVEX_URL=$CONVEX_URL
VITE_WORKSPACE_ID=$WORKSPACE_ID
EOF
echo -e "  ${GREEN}✓${NC} Created apps/widget/.env.local"

# apps/mobile/.env.local
cat > apps/mobile/.env.local << EOF
EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL=$CONVEX_URL
EXPO_PUBLIC_CONVEX_URL=$CONVEX_URL
EXPO_PUBLIC_WORKSPACE_ID=$WORKSPACE_ID
EOF
echo -e "  ${GREEN}✓${NC} Created apps/mobile/.env.local"

# packages/react-native-sdk/example/.env.local
cat > packages/react-native-sdk/example/.env.local << EOF
EXPO_PUBLIC_CONVEX_URL=$CONVEX_URL
EXPO_PUBLIC_WORKSPACE_ID=$WORKSPACE_ID
EOF
echo -e "  ${GREEN}✓${NC} Created packages/react-native-sdk/example/.env.local"

# packages/convex/.env.local (for Convex URL reference)
cat > packages/convex/.env.local << EOF
CONVEX_URL=$CONVEX_URL
EOF
echo -e "  ${GREEN}✓${NC} Created packages/convex/.env.local"

# Success message
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Convex URL:    $CONVEX_URL"
echo -e "  Workspace ID:  $WORKSPACE_ID"
echo -e "  Admin Email:   $ADMIN_EMAIL"
echo ""

if [ "$SKIP_DEV_SERVER" = true ]; then
  echo -e "${BLUE}To start development servers:${NC}"
  echo -e "  pnpm dev:web     # Web dashboard at http://localhost:3000"
  echo -e "  pnpm dev:widget  # Widget at http://localhost:5173"
  echo ""
else
  echo -e "${BLUE}Starting development servers...${NC}"
  echo ""
  echo -e "  Web dashboard: ${GREEN}http://localhost:3000${NC}"
  echo -e "  Widget:        ${GREEN}http://localhost:5173${NC}"
  echo ""
  echo -e "Press Ctrl+C to stop the servers."
  echo ""

  # Start dev servers
  pnpm dev:web & pnpm dev:widget &
  wait
fi

echo -e "${BLUE}To run the React Native SDK example:${NC}"
echo -e "  cd packages/react-native-sdk/example"
echo -e "  pnpm start"
echo ""
echo -e "${BLUE}Login credentials:${NC}"
echo -e "  Email:    $ADMIN_EMAIL"
echo -e "  Password: (the one you provided)"
echo ""
