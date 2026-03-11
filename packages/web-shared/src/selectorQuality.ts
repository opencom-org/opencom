export type SelectorQualityGrade = "good" | "fair" | "poor";

export interface SelectorQualitySignals {
  matchCount?: number;
  depth: number;
  usesNth: boolean;
  hasId: boolean;
  hasDataAttribute: boolean;
  classCount: number;
  usesWildcard: boolean;
}

export interface SelectorQualityMetadata {
  score: number;
  grade: SelectorQualityGrade;
  warnings: string[];
  signals: SelectorQualitySignals;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function gradeFromScore(score: number): SelectorQualityGrade {
  if (score >= 80) return "good";
  if (score >= 55) return "fair";
  return "poor";
}

function countSelectorDepth(selector: string): number {
  return selector
    .split(">")
    .flatMap((part) => part.trim().split(/\s+/))
    .filter(Boolean).length;
}

export function scoreSelectorQuality(
  selector: string,
  options?: { matchCount?: number }
): SelectorQualityMetadata {
  const trimmed = selector.trim();
  if (!trimmed) {
    return {
      score: 0,
      grade: "poor",
      warnings: ["Selector is empty."],
      signals: {
        matchCount: options?.matchCount,
        depth: 0,
        usesNth: false,
        hasId: false,
        hasDataAttribute: false,
        classCount: 0,
        usesWildcard: false,
      },
    };
  }

  const depth = countSelectorDepth(trimmed);
  const usesNth = /:nth-(?:child|of-type)\(/.test(trimmed);
  const hasId = /#[A-Za-z0-9_-]+/.test(trimmed);
  const hasDataAttribute = /\[data-[^\]]+\]/.test(trimmed);
  const classCount = (trimmed.match(/\.[A-Za-z0-9_-]+/g) ?? []).length;
  const usesWildcard = /(^|[\s>+~])\*/.test(trimmed);
  const matchCount = options?.matchCount;

  const warnings: string[] = [];
  let score = 100;

  if (matchCount !== undefined) {
    if (matchCount === 0) {
      score -= 45;
      warnings.push("Selector matches no elements.");
    } else if (matchCount > 1) {
      score -= Math.min(40, 10 + (matchCount - 2) * 5);
      warnings.push(`Selector matches ${matchCount} elements; expected exactly one.`);
    }
  }

  if (usesNth) {
    score -= 20;
    warnings.push("Selector relies on positional matching (`:nth-*`) and may be fragile.");
  }

  if (depth > 4) {
    score -= Math.min(25, (depth - 4) * 5);
    warnings.push("Selector depth is high and may break with layout changes.");
  }

  if (usesWildcard) {
    score -= 12;
    warnings.push("Selector uses wildcard matching (`*`), which is typically unstable.");
  }

  if (!hasId && !hasDataAttribute) {
    score -= 10;
    warnings.push("Selector lacks stable id/data-attribute anchors.");
  }

  if (classCount >= 4) {
    score -= 8;
    warnings.push("Selector depends on many classes; class churn may break targeting.");
  }

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    grade: gradeFromScore(finalScore),
    warnings,
    signals: {
      matchCount,
      depth,
      usesNth,
      hasId,
      hasDataAttribute,
      classCount,
      usesWildcard,
    },
  };
}
