## ADDED Requirements

### Requirement: Article links in messages MUST use consistent format with AI sources

Article links inserted by agents SHALL use the same article ID-based format as AI response sources for consistent widget navigation.

#### Scenario: Agent-inserted article link opens in widget

- **WHEN** a visitor clicks an article link in a message from an agent
- **THEN** the widget SHALL open the article view using the same navigation as AI sources
- **AND** the article SHALL be identified by its ID, not slug
