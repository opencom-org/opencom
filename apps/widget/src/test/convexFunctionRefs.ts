import { getFunctionName } from "convex/server";

const FUNCTION_NAME_SYMBOL_FRAGMENT = "functionName";

type RefLikeObject = {
  functionName?: string;
  name?: string;
  reference?: { functionName?: string; name?: string };
};

function getSymbolFunctionPath(ref: object): string | undefined {
  const functionNameSymbol = Object.getOwnPropertySymbols(ref).find((symbol) =>
    String(symbol).includes(FUNCTION_NAME_SYMBOL_FRAGMENT)
  );

  if (!functionNameSymbol) {
    return undefined;
  }

  const symbolValue = (ref as Record<symbol, unknown>)[functionNameSymbol];
  return typeof symbolValue === "string" ? symbolValue : undefined;
}

function getConvexFunctionPath(ref: unknown): string | null {
  try {
    return getFunctionName(ref as never);
  } catch {
    return null;
  }
}

function toCanonicalFunctionPath(value: string): string {
  return value.includes(":") ? value : value.replace(".", ":");
}

export function getFunctionPath(ref: unknown): string {
  if (typeof ref === "string") {
    return ref;
  }

  const convexFunctionPath = getConvexFunctionPath(ref);
  if (convexFunctionPath) {
    return convexFunctionPath;
  }

  if (ref && typeof ref === "object") {
    const maybeRef = ref as RefLikeObject;

    return (
      getSymbolFunctionPath(ref) ??
      maybeRef.functionName ??
      maybeRef.name ??
      maybeRef.reference?.functionName ??
      maybeRef.reference?.name ??
      ""
    );
  }

  return "";
}

export function matchesFunctionPath(refOrPath: unknown, expectedPath: string): boolean {
  const functionPath = typeof refOrPath === "string" ? refOrPath : getFunctionPath(refOrPath);
  if (!functionPath) {
    return false;
  }

  return toCanonicalFunctionPath(functionPath) === toCanonicalFunctionPath(expectedPath);
}
