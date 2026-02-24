# Opencom React Native SDK Example

A minimal Expo app demonstrating the `@opencom/react-native-sdk`.

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_WORKSPACE_ID=your-workspace-id
```

### 3. Run the App

```bash
# iOS
pnpm ios

# Android
pnpm android
```

## Project Structure

```
example/
├── App.tsx           # Single-screen app with SDK demo
├── app.json          # Expo configuration
├── package.json      # Dependencies
└── .env.example      # Environment template
```

## SDK Usage

```typescript
import { OpencomSDK } from "@opencom/react-native-sdk";

// Initialize (done automatically in App.tsx)
await OpencomSDK.initialize({
  workspaceId: "your-workspace-id",
  convexUrl: "https://your-deployment.convex.cloud",
});

// Open the chat messenger
OpencomSDK.present();
```
