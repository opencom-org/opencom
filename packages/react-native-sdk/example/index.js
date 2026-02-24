// Polyfill crypto.getRandomValues for Convex in React Native
import "expo-crypto";

import { LogBox } from "react-native";
import { registerRootComponent } from "expo";
import App from "./App";

// Ignore all warnings and errors in development mode for E2E tests
// These don't affect app functionality but block the UI during Maestro tests
LogBox.ignoreAllLogs(true);

registerRootComponent(App);
