# shared-markdown-rendering-sanitization Specification

## Purpose

TBD - created by archiving change unify-markdown-rendering-utility. Update Purpose after archive.

## Requirements

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

### Requirement: Shared markdown utility MUST detect article links for in-widget navigation

The shared markdown utility SHALL detect `article:` protocol links and emit metadata for in-widget article navigation.

#### Scenario: Article link is rendered with navigation metadata

- **WHEN** markdown contains a link in the format `[title](article:<articleId>)`
- **THEN** the rendered anchor SHALL include a `data-article-id` attribute with the article ID
- **AND** the link SHALL NOT have `target="_blank"` (in-widget navigation)

#### Scenario: Article link click is handled by widget

- **WHEN** a visitor clicks an article link in the widget
- **THEN** the widget SHALL call `onSelectArticle(articleId)` to open the article view
- **AND** the link SHALL NOT open in a new browser tab
