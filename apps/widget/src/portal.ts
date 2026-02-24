/**
 * Shared portal target for widget overlays (tours, tooltips).
 *
 * When the widget uses Shadow DOM, overlays must portal into the shadow root
 * (not document.body) so their CSS — which lives inside the shadow root —
 * still applies.  position:fixed inside the shadow root still covers the
 * full viewport, so overlays render identically.
 *
 * Falls back to document.body when Shadow DOM is not in use (e.g. dev mode
 * without init()).
 */

let portalTarget: HTMLElement | null = null;
let shadowHostEl: HTMLElement | null = null;

export function setPortalTarget(el: HTMLElement) {
  portalTarget = el;
}

export function getPortalTarget(): HTMLElement {
  return portalTarget || document.body;
}

export function setShadowHost(el: HTMLElement) {
  shadowHostEl = el;
}

/**
 * Returns the element where CSS custom properties should be set.
 * With Shadow DOM, this is the shadow host (properties on :host inherit
 * into the shadow tree). Falls back to document.documentElement when
 * Shadow DOM is not in use.
 */
export function getThemeRoot(): HTMLElement {
  return shadowHostEl || document.documentElement;
}
