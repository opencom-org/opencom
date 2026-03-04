export interface ConvexCompatibilityRange {
  minimum: string;
  current: string;
  maximum: string;
}

export const SDK_CORE_CONVEX_COMPATIBILITY: ConvexCompatibilityRange = {
  minimum: "1.0.0",
  current: "1.0.0",
  maximum: "1.x",
};

export class OpencomConvexCompatibilityError extends Error {
  readonly code = "OPENCOM_UNSUPPORTED_CONVEX_CONTRACT";
  readonly packageName: string;
  readonly detectedVersion: string;
  readonly supportedRange: ConvexCompatibilityRange;

  constructor(params: {
    packageName: string;
    detectedVersion: string;
    supportedRange: ConvexCompatibilityRange;
  }) {
    const { packageName, detectedVersion, supportedRange } = params;
    super(
      `[OpencomSDK] ${packageName} does not support backend contract version ${detectedVersion}. ` +
        `Supported range is ${supportedRange.minimum} to ${supportedRange.maximum}. ` +
        "Upgrade your SDK package or deploy a compatible backend contract version."
    );
    this.name = "OpencomConvexCompatibilityError";
    this.packageName = packageName;
    this.detectedVersion = detectedVersion;
    this.supportedRange = supportedRange;
  }
}

const CONTRACT_VERSION_RE = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

function parseContractVersion(version: string): ParsedVersion | null {
  const match = version.trim().match(CONTRACT_VERSION_RE);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? "0"),
    patch: Number(match[3] ?? "0"),
    prerelease: match[4] ?? null,
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  return left.prerelease.localeCompare(right.prerelease);
}

export function normalizeContractVersion(version: string): string {
  const parsed = parseContractVersion(version);
  if (!parsed) {
    throw new Error(`[OpencomSDK] Invalid backend contract version: "${version}"`);
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${
    parsed.prerelease ? `-${parsed.prerelease}` : ""
  }`;
}

function parseMaximumRangeToken(maximum: string):
  | { kind: "major"; major: number }
  | { kind: "exact"; version: ParsedVersion }
  | null {
  const token = maximum.trim();
  if (token.endsWith(".x")) {
    const major = Number(token.slice(0, token.length - 2));
    if (!Number.isInteger(major)) {
      return null;
    }
    return { kind: "major", major };
  }

  const parsed = parseContractVersion(token);
  if (!parsed) {
    return null;
  }

  return { kind: "exact", version: parsed };
}

export function isConvexContractVersionSupported(
  version: string,
  range: ConvexCompatibilityRange = SDK_CORE_CONVEX_COMPATIBILITY
): boolean {
  const parsedVersion = parseContractVersion(version);
  const parsedMinimum = parseContractVersion(range.minimum);
  const parsedCurrent = parseContractVersion(range.current);
  const maximumToken = parseMaximumRangeToken(range.maximum);

  if (!parsedVersion || !parsedMinimum || !parsedCurrent || !maximumToken) {
    return false;
  }

  if (compareVersions(parsedCurrent, parsedMinimum) < 0) {
    return false;
  }

  if (compareVersions(parsedVersion, parsedMinimum) < 0) {
    return false;
  }

  if (maximumToken.kind === "major") {
    return parsedVersion.major === maximumToken.major;
  }

  return compareVersions(parsedVersion, maximumToken.version) <= 0;
}

export function assertConvexContractCompatibility(
  version: string,
  params?: {
    packageName?: string;
    range?: ConvexCompatibilityRange;
  }
): void {
  const range = params?.range ?? SDK_CORE_CONVEX_COMPATIBILITY;
  const packageName = params?.packageName ?? "@opencom/sdk-core";
  const normalized = normalizeContractVersion(version);
  if (!isConvexContractVersionSupported(normalized, range)) {
    throw new OpencomConvexCompatibilityError({
      packageName,
      detectedVersion: normalized,
      supportedRange: range,
    });
  }
}

function normalizeConvexBaseUrl(convexUrl: string): string {
  const parsed = new URL(convexUrl);
  return parsed.href.endsWith("/") ? parsed.href.slice(0, -1) : parsed.href;
}

export async function discoverBackendContractVersion(
  convexUrl: string
): Promise<string | null> {
  const fetchImpl = globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return null;
  }

  try {
    const discoveryUrl = `${normalizeConvexBaseUrl(convexUrl)}/.well-known/opencom.json`;
    const response = await fetchImpl(discoveryUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as { version?: unknown };
    if (typeof json.version !== "string" || json.version.trim().length === 0) {
      return null;
    }

    return normalizeContractVersion(json.version);
  } catch {
    return null;
  }
}
