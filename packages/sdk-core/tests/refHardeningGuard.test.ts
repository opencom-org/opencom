import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(TEST_DIR, "../src/api");

const COVERED_WRAPPER_FILES = [
  resolve(API_DIR, "aiAgent.ts"),
  resolve(API_DIR, "articles.ts"),
  resolve(API_DIR, "carousels.ts"),
  resolve(API_DIR, "checklists.ts"),
  resolve(API_DIR, "commonIssues.ts"),
  resolve(API_DIR, "conversations.ts"),
  resolve(API_DIR, "events.ts"),
  resolve(API_DIR, "officeHours.ts"),
  resolve(API_DIR, "outbound.ts"),
  resolve(API_DIR, "sessions.ts"),
  resolve(API_DIR, "tickets.ts"),
  resolve(API_DIR, "visitors.ts"),
];

const APPROVED_TS2589_HOTSPOT_FILES = [
  resolve(API_DIR, "aiAgent.ts"),
  resolve(API_DIR, "articles.ts"),
  resolve(API_DIR, "carousels.ts"),
  resolve(API_DIR, "checklists.ts"),
  resolve(API_DIR, "commonIssues.ts"),
  resolve(API_DIR, "conversations.ts"),
  resolve(API_DIR, "events.ts"),
  resolve(API_DIR, "officeHours.ts"),
  resolve(API_DIR, "outbound.ts"),
  resolve(API_DIR, "sessions.ts"),
  resolve(API_DIR, "tickets.ts"),
  resolve(API_DIR, "visitors.ts"),
];
const FORBIDDEN_REF_HELPERS = new Set(["getQueryRef", "getMutationRef"]);

function formatViolation(filePath: string, sourceFile: ts.SourceFile, node: ts.Node, reason: string): string {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${basename(filePath)}:${line + 1}:${character + 1} ${reason}`;
}

function isApiPropertyAccess(expression: ts.Expression): boolean {
  let current: ts.Expression = expression;

  while (ts.isPropertyAccessExpression(current)) {
    current = current.expression;
  }

  return ts.isIdentifier(current) && current.text === "api";
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function isStringLiteralLike(expression: ts.Expression | undefined): boolean {
  return !!expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression));
}

function collectWrapperViolations(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: string[] = [];
  const allowsFixedRefHotspot = APPROVED_TS2589_HOTSPOT_FILES.includes(filePath);
  let hasGeneratedApiRefConstant = false;
  let hasApprovedFixedRefConstant = false;

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name && FORBIDDEN_REF_HELPERS.has(node.name.text)) {
      violations.push(formatViolation(filePath, sourceFile, node.name, "forbidden ref helper declaration"));
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (FORBIDDEN_REF_HELPERS.has(node.name.text)) {
        violations.push(formatViolation(filePath, sourceFile, node.name, "forbidden ref helper declaration"));
      }

      if (
        node.name.text.endsWith("_REF") &&
        node.initializer &&
        ts.isPropertyAccessExpression(unwrapExpression(node.initializer)) &&
        isApiPropertyAccess(unwrapExpression(node.initializer))
      ) {
        hasGeneratedApiRefConstant = true;
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (FORBIDDEN_REF_HELPERS.has(node.expression.text)) {
        violations.push(formatViolation(filePath, sourceFile, node.expression, "forbidden ref helper invocation"));
      }

      if (node.expression.text === "makeFunctionReference") {
        if (!isStringLiteralLike(node.arguments[0])) {
          violations.push(
            formatViolation(filePath, sourceFile, node.expression, "dynamic makeFunctionReference argument")
          );
        } else if (!allowsFixedRefHotspot) {
          violations.push(
            formatViolation(filePath, sourceFile, node.expression, "unapproved manual makeFunctionReference call")
          );
        } else {
          hasApprovedFixedRefConstant = true;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (allowsFixedRefHotspot) {
    if (!source.includes("TS2589")) {
      violations.push(`${basename(filePath)} missing TS2589 hotspot comment for approved fixed refs`);
    }
    if (!hasApprovedFixedRefConstant) {
      violations.push(`${basename(filePath)} missing approved TS2589 fixed ref constant`);
    }
  } else if (!hasGeneratedApiRefConstant) {
    violations.push(`${basename(filePath)} missing module-scope generated api ref constant`);
  }

  return violations;
}

describe("sdk-core ref hardening guards", () => {
  it("freezes the March 11 2026 covered wrapper inventory", () => {
    expect(COVERED_WRAPPER_FILES.map((filePath) => basename(filePath))).toEqual([
      "aiAgent.ts",
      "articles.ts",
      "carousels.ts",
      "checklists.ts",
      "commonIssues.ts",
      "conversations.ts",
      "events.ts",
      "officeHours.ts",
      "outbound.ts",
      "sessions.ts",
      "tickets.ts",
      "visitors.ts",
    ]);
  });

  it("keeps covered wrappers on generated module-scope Convex refs", () => {
    const violations = COVERED_WRAPPER_FILES.flatMap((filePath) => collectWrapperViolations(filePath));

    expect(violations).toEqual([]);
  });
});
