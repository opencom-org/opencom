## ADDED Requirements

### Requirement: Web and widget MUST consume a shared markdown rendering implementation

Markdown rendering and sanitization SHALL be implemented in a shared utility module consumed by both web and widget surfaces.

#### Scenario: Core parser behavior update

- **WHEN** parser settings (for example breaks/linkify behavior) are changed
- **THEN** the update SHALL be made in the shared utility
- **AND** both web and widget SHALL consume the updated behavior through shared imports

### Requirement: Shared sanitization policy MUST enforce equivalent safety guarantees

The shared utility MUST apply one canonical sanitization and link-hardening policy for supported markdown content.

#### Scenario: Unsafe protocol appears in markdown link

- **WHEN** markdown contains a link with a disallowed protocol
- **THEN** rendered output SHALL remove or neutralize that unsafe link target
- **AND** surrounding content SHALL still render safely

#### Scenario: Allowed markdown image/link content is rendered

- **WHEN** markdown includes allowed link and image content
- **THEN** rendering SHALL preserve allowed elements and attributes according to the shared policy

### Requirement: Shared utility MUST preserve frontmatter stripping and excerpt helper behavior

The shared utility SHALL support frontmatter stripping and plain-text excerpt helpers used by consuming surfaces.

#### Scenario: Markdown includes YAML frontmatter

- **WHEN** input markdown begins with frontmatter metadata
- **THEN** rendered output and excerpt generation SHALL ignore the frontmatter block
