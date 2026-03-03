# help-center-markdown-media-assets Specification

## Purpose
TBD - created by archiving change help-center-markdown-image-assets. Update Purpose after archive.
## Requirements
### Requirement: Markdown folder imports MUST ingest referenced local image assets

The system MUST accept supported image files together with markdown files during Help Center folder sync. The import pipeline MUST detect local image references in markdown content and associate each resolvable reference with an uploaded storage-backed asset.

#### Scenario: Import includes markdown and referenced images

- **WHEN** a user uploads a docs folder containing markdown files and referenced local images
- **THEN** the import pipeline SHALL upload supported image files and persist asset metadata
- **AND** markdown references that resolve to uploaded files SHALL be converted to stable internal asset references before article content is saved

#### Scenario: Markdown references missing files

- **WHEN** markdown contains local image references that do not match any uploaded file
- **THEN** the sync preview/apply response MUST report unresolved references with file context
- **AND** unresolved references MUST NOT crash the import operation

### Requirement: Stored article markdown MUST use stable asset references

The system SHALL store internal image references in a stable, storage-agnostic format so article content remains valid regardless of storage URL rotation.

#### Scenario: New image reference is saved

- **WHEN** import or editor upload introduces a new internal image reference
- **THEN** the saved markdown MUST use the canonical `oc-asset://<assetId>` form
- **AND** the mapped asset record MUST belong to the same workspace as the article

### Requirement: Article renderers MUST resolve internal asset references safely

Both web Help Center article pages and widget article detail views MUST resolve internal asset references to displayable URLs at render time and MUST preserve existing sanitization guarantees for links and media.

#### Scenario: Web help article renders internal image references

- **WHEN** a published article contains `oc-asset://` references
- **THEN** the web renderer SHALL resolve each reference to a current storage URL and render the image
- **AND** disallowed protocols and unsafe attributes MUST still be stripped

#### Scenario: Widget article renders internal image references

- **WHEN** a widget article contains `oc-asset://` references
- **THEN** the widget renderer SHALL resolve each reference and render the image consistently with markdown output
- **AND** unresolved references SHALL not break rendering of surrounding content

### Requirement: Article editor MUST support direct image upload and insertion

The article editor MUST provide a user flow to upload image files to Convex storage, register them as article assets, and insert markdown image syntax pointing to the internal reference.

#### Scenario: Editor uploads and inserts an image

- **WHEN** an editor uploads a supported image in an article edit session
- **THEN** the system SHALL store the image, create an asset record, and return a markdown snippet using `oc-asset://<assetId>`
- **AND** the user SHALL be able to insert that snippet into article content without manual URL hosting

### Requirement: Markdown export MUST produce portable docs with image files

The export pipeline MUST include image binaries required by exported markdown and rewrite internal references to relative paths that render in local markdown viewers.

#### Scenario: Export includes referenced image assets

- **WHEN** a user exports markdown for articles containing internal image references
- **THEN** the export archive SHALL contain those image files in deterministic paths
- **AND** exported markdown SHALL reference those files by relative path

#### Scenario: Re-import of exported bundle preserves images

- **WHEN** an exported bundle is re-imported unchanged
- **THEN** image references SHALL resolve correctly after import
- **AND** articles SHALL render images successfully in both web and widget views

### Requirement: Asset lifecycle operations MUST enforce safety and integrity

The system MUST validate image mime type and size on upload, prevent cross-workspace asset reference usage, and provide orphan cleanup behavior for unreferenced assets.

#### Scenario: Upload validation failure

- **WHEN** an uploaded file exceeds limits or has an unsupported mime type
- **THEN** the upload finalization MUST be rejected with a validation error
- **AND** no asset record SHALL be created for the invalid file

#### Scenario: Asset deletion with active references

- **WHEN** a user requests deletion of an asset still referenced by an article
- **THEN** the system MUST either block deletion with explicit reference details or require a forced replacement flow
- **AND** it MUST NOT leave dangling internal references silently

