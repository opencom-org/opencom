## ADDED Requirements

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
