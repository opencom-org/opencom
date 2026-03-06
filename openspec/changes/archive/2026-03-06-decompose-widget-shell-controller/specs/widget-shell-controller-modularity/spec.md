## ADDED Requirements

### Requirement: Widget shell MUST separate controller orchestration from main-shell rendering

The widget shell SHALL organize high-volume tabbed shell rendering in dedicated view modules while keeping top-level orchestration in `Widget.tsx`.

#### Scenario: Updating tabbed shell UI

- **WHEN** a contributor changes tabbed-shell markup or tab-action presentation
- **THEN** edits SHALL be isolated to `widgetShell` render modules
- **AND** query/mutation orchestration in `Widget.tsx` SHALL not require unrelated edits

### Requirement: Shell decomposition MUST preserve Widget contracts and behavior

Refactor SHALL preserve `Widget` prop contracts, tab behavior, and existing test selectors/flows.

#### Scenario: Existing widget shell tests execute after decomposition

- **WHEN** shell orchestration tests exercise launcher, tabs, tickets, and tour start flows
- **THEN** existing behavior SHALL remain intact
- **AND** widget/web typechecks SHALL remain compatible
