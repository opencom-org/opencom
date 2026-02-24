export interface DiscoveryResponse {
  version: string;
  name: string;
  convexUrl: string;
  features?: string[];
  signupMode?: "invite-only" | "domain-allowlist";
  authMethods?: ("password" | "otp")[];
}

export interface StoredBackend {
  url: string;
  name: string;
  convexUrl: string;
  features?: string[];
  lastUsed: string;
  signupMode?: "invite-only" | "domain-allowlist";
  authMethods?: ("password" | "otp")[];
}

export interface BackendStorage {
  backends: StoredBackend[];
  activeBackend: string | null;
}

export interface BackendValidationResult {
  valid: boolean;
  error?: string;
  discovery?: DiscoveryResponse;
}
