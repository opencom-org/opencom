export function checkElementsAvailable(selectors: (string | undefined)[]): boolean {
  return selectors.filter(Boolean).every((sel) => document.querySelector(sel as string));
}
