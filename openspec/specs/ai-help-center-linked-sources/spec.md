# ai-help-center-linked-sources Specification

## Purpose

TBD - created by archiving change add-help-center-links-in-ai-responses. Update Purpose after archive.

## Requirements

### Requirement: AI response source records MUST include linkable metadata for article sources

AI response source entries associated with Help Center articles SHALL include metadata required for reliable article navigation.

#### Scenario: AI response references published article

- **WHEN** AI response includes a Help Center article source
- **THEN** source metadata SHALL include linkable article identity fields for UI navigation

### Requirement: Widget AI messages MUST render article sources as clickable links

Widget conversation UI SHALL render article-backed AI sources as clickable elements that open the corresponding article context.

#### Scenario: Visitor taps article source in AI message

- **WHEN** widget displays an AI message with article sources
- **THEN** selecting a source SHALL open the referenced article view

### Requirement: Non-article sources MUST degrade gracefully

Sources without linkable article targets SHALL remain visible as attribution text and MUST NOT render broken links.

#### Scenario: AI response includes snippet source

- **WHEN** AI response includes a non-article source
- **THEN** UI SHALL display source attribution without invalid navigation affordances

### Requirement: Article links in messages MUST use consistent format with AI sources

Article links inserted by agents SHALL use the same article ID-based format as AI response sources for consistent widget navigation.

#### Scenario: Agent-inserted article link opens in widget

- **WHEN** a visitor clicks an article link in a message from an agent
- **THEN** the widget SHALL open the article view using the same navigation as AI sources
- **AND** the article SHALL be identified by its ID, not slug
