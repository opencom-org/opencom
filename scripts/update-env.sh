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

echo -e "${BLUE}Opencom Environment Update Script${NC}"
echo ""

# Parse arguments
CONVEX_URL=""
WORKSPACE_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --url)
      CONVEX_URL="$2"
      shift 2
      ;;
    --workspace)
      WORKSPACE_ID="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./update-env.sh [options]"
      echo ""
      echo "Options:"
      echo "  --url URL            Convex deployment URL"
      echo "  --workspace ID       Workspace ID"
      echo "  -h, --help           Show this help message"
      echo ""
      echo "If options are not provided, you will be prompted for values."
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Prompt for values if not provided
if [ -z "$CONVEX_URL" ]; then
  # Try to get current value
  CURRENT_URL=""
  if [ -f "$ROOT_DIR/apps/web/.env.local" ]; then
    CURRENT_URL=$(grep "CONVEX_URL" "$ROOT_DIR/apps/web/.env.local" | cut -d'=' -f2 | head -1)
  fi

  if [ -n "$CURRENT_URL" ]; then
    read -p "Enter Convex URL [$CURRENT_URL]: " CONVEX_URL
    CONVEX_URL=${CONVEX_URL:-$CURRENT_URL}
  else
    read -p "Enter Convex URL: " CONVEX_URL
  fi
fi

if [ -z "$WORKSPACE_ID" ]; then
  # Try to get current value
  CURRENT_WORKSPACE=""
  if [ -f "$ROOT_DIR/apps/widget/.env.local" ]; then
    CURRENT_WORKSPACE=$(grep "WORKSPACE_ID" "$ROOT_DIR/apps/widget/.env.local" | cut -d'=' -f2 | head -1)
  fi

  if [ -n "$CURRENT_WORKSPACE" ]; then
    read -p "Enter Workspace ID [$CURRENT_WORKSPACE]: " WORKSPACE_ID
    WORKSPACE_ID=${WORKSPACE_ID:-$CURRENT_WORKSPACE}
  else
    read -p "Enter Workspace ID: " WORKSPACE_ID
  fi
fi

if [ -z "$CONVEX_URL" ] || [ -z "$WORKSPACE_ID" ]; then
  echo -e "${RED}Error: Both Convex URL and Workspace ID are required${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Updating environment files...${NC}"

cd "$ROOT_DIR"

# Update or create apps/web/.env.local
cat > apps/web/.env.local << EOF
NEXT_PUBLIC_CONVEX_URL=$CONVEX_URL
NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL=$CONVEX_URL
EOF
echo -e "  ${GREEN}✓${NC} Updated apps/web/.env.local"

# Update or create apps/widget/.env.local
cat > apps/widget/.env.local << EOF
VITE_CONVEX_URL=$CONVEX_URL
VITE_WORKSPACE_ID=$WORKSPACE_ID
EOF
echo -e "  ${GREEN}✓${NC} Updated apps/widget/.env.local"

# Update or create apps/mobile/.env.local
cat > apps/mobile/.env.local << EOF
EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL=$CONVEX_URL
EXPO_PUBLIC_CONVEX_URL=$CONVEX_URL
EXPO_PUBLIC_WORKSPACE_ID=$WORKSPACE_ID
EOF
echo -e "  ${GREEN}✓${NC} Updated apps/mobile/.env.local"

# Update or create packages/react-native-sdk/example/.env.local
cat > packages/react-native-sdk/example/.env.local << EOF
EXPO_PUBLIC_CONVEX_URL=$CONVEX_URL
EXPO_PUBLIC_WORKSPACE_ID=$WORKSPACE_ID
EOF
echo -e "  ${GREEN}✓${NC} Updated packages/react-native-sdk/example/.env.local"

# Update or create packages/convex/.env.local
cat > packages/convex/.env.local << EOF
CONVEX_URL=$CONVEX_URL
EOF
echo -e "  ${GREEN}✓${NC} Updated packages/convex/.env.local"

echo ""
echo -e "${GREEN}Environment files updated successfully!${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Convex URL:    $CONVEX_URL"
echo -e "  Workspace ID:  $WORKSPACE_ID"
echo ""
