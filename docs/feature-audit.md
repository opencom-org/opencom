# Feature Audit Checklist

This document provides a comprehensive inventory of all features, functionality, pages, and settings across Opencom applications and packages. It serves as a living document for tracking development progress and testing coverage.

## How to Use This Document

1. **Find features** - Navigate to the relevant section (Web App, Widget, Mobile, etc.)
2. **Check status** - Review development and testing status columns
3. **Identify gaps** - Look for features lacking test coverage
4. **Update regularly** - Keep this document current as features are added or tested

## Ownership

| Section              | Owner        | Update Frequency |
| -------------------- | ------------ | ---------------- |
| Web App (1.x)        | Web Team     | Per release      |
| Widget (2.x)         | Widget Team  | Per release      |
| Mobile App (3.x)     | Mobile Team  | Per release      |
| SDKs (4.x)           | SDK Team     | Per release      |
| Backend (5.x)        | Backend Team | Per release      |
| Infrastructure (7.x) | DevOps       | Quarterly        |

## Legend

### Development Status

- **Complete**: Feature is fully implemented and functional
- **Partial**: Core functionality exists but missing some capabilities
- **In Progress**: Active development underway
- **Planned**: Documented in proposals but not yet started
- **Not Started**: Identified but no proposal exists

### Testing Status

- **Manual**: Manual testing completed
- **Unit**: Unit tests exist
- **Integration**: Integration tests exist
- **E2E**: End-to-end tests exist
- **None**: No testing coverage

---

# 1. Web Application (Admin Dashboard)

## 1.1 Authentication & Authorization

| Feature                         | Dev Status | Manual | Unit | Integration | E2E | Notes                                   |
| ------------------------------- | ---------- | ------ | ---- | ----------- | --- | --------------------------------------- |
| Email/Password Login            | Complete   |        |      |             | ✓   | `apps/web/src/app/login`                |
| OTP/Magic Link Login            | Complete   |        |      |             | ✓   | Email code authentication               |
| Session Management              | Complete   |        |      |             | ✓   | Token-based auth sessions               |
| Logout                          | Complete   |        |      |             | ✓   |                                         |
| Password Reset                  | Partial    |        |      |             |     | Basic flow exists                       |
| Multi-workspace Support         | Complete   |        |      |             |     | Users can belong to multiple workspaces |
| Role-based Access (Admin/Agent) | Complete   |        |      |             |     |                                         |

## 1.2 Inbox (Agent Workspace)

| Feature                                   | Dev Status | Manual | Unit | Integration | E2E | Notes                         |
| ----------------------------------------- | ---------- | ------ | ---- | ----------- | --- | ----------------------------- |
| Conversation List                         | Complete   |        |      |             | ✓   | Real-time updates via Convex  |
| Conversation Detail View                  | Complete   |        |      |             | ✓   |                               |
| Send Messages                             | Complete   |        |      |             |     |                               |
| Real-time Message Updates                 | Complete   |        |      |             |     | Convex subscriptions          |
| Visitor Presence Indicator                | Complete   |        |      |             |     | Online/offline status         |
| Conversation Status (Open/Closed/Snoozed) | Complete   |        |      |             |     |                               |
| Unread Message Count                      | Complete   |        |      |             |     |                               |
| Channel Indicator (Chat/Email)            | Complete   |        |      |             |     |                               |
| Email Subject Display                     | Complete   |        |      |             |     |                               |
| Email Metadata (From/To/Attachments)      | Complete   |        |      |             |     |                               |
| Snippet Picker (/ shortcut)               | Complete   |        |      |             |     |                               |
| Article Link Insertion                    | Complete   |        |      |             |     |                               |
| Knowledge Search (Ctrl+K)                 | Complete   |        |      |             |     | Unified search across content |
| Recently Used Content                     | Complete   |        |      |             |     |                               |
| Convert to Ticket                         | Complete   |        |      |             |     |                               |
| AI Suggestions Panel                      | Complete   |        |      |             |     | Semantic search suggestions   |
| Mark as Read                              | Complete   |        |      |             |     |                               |
| Conversation Assignment                   | Partial    |        |      |             |     | Basic assignment exists       |
| Conversation Search                       | Planned    |        |      |             |     |                               |
| Bulk Actions                              | Planned    |        |      |             |     |                               |
| Keyboard Shortcuts                        | Partial    |        |      |             |     | Ctrl+K exists                 |
| Internal Notes                            | Planned    |        |      |             |     |                               |
| @Mentions                                 | Planned    |        |      |             |     |                               |

## 1.3 Help Center / Knowledge Base

| Feature                          | Dev Status | Manual | Unit | Integration | E2E | Notes                       |
| -------------------------------- | ---------- | ------ | ---- | ----------- | --- | --------------------------- |
| Article List                     | Complete   |        |      |             |     | `apps/web/src/app/articles` |
| Article Editor (Markdown)        | Complete   |        |      |             |     |                             |
| Article Create/Edit/Delete       | Complete   |        |      |             |     |                             |
| Article Status (Draft/Published) | Complete   |        |      |             |     |                             |
| Collections (Categories)         | Complete   |        |      |             |     | Hierarchical organization   |
| Article Search                   | Complete   |        |      |             |     | Full-text search            |
| Article Slug/URL                 | Complete   |        |      |             |     |                             |
| Article Feedback (Helpful?)      | Complete   |        |      |             |     |                             |
| Audience Targeting Rules         | Complete   |        |      |             |     |                             |
| Public Help Center Page          | Complete   |        |      |             |     | `apps/web/src/app/help`     |
| Article Ordering                 | Complete   |        |      |             |     |                             |
| Multi-language Support           | Planned    |        |      |             |     |                             |
| Article Analytics                | Planned    |        |      |             |     |                             |
| Custom Domain                    | Planned    |        |      |             |     |                             |
| SEO Optimization                 | Planned    |        |      |             |     |                             |

## 1.4 Knowledge Hub (Internal Content)

| Feature                        | Dev Status | Manual | Unit | Integration | E2E | Notes                          |
| ------------------------------ | ---------- | ------ | ---- | ----------- | --- | ------------------------------ |
| Content Folders                | Complete   |        |      |             | ✓   | Hierarchical organization      |
| Internal Articles              | Complete   |        |      |             | ✓   | Agent-only documentation       |
| Internal Article Editor        | Complete   |        |      |             | ✓   |                                |
| Internal Article Search        | Complete   |        |      |             | ✓   |                                |
| Content Tags                   | Complete   |        |      |             |     |                                |
| Recent Content Access Tracking | Complete   |        |      |             |     |                                |
| Unified Knowledge Search       | Complete   |        |      |             |     | Articles + Internal + Snippets |

## 1.5 Snippets (Saved Replies)

| Feature                    | Dev Status | Manual | Unit | Integration | E2E | Notes                           |
| -------------------------- | ---------- | ------ | ---- | ----------- | --- | ------------------------------- |
| Snippet List               | Complete   |        |      |             |     | `apps/web/src/app/snippets`     |
| Snippet Create/Edit/Delete | Complete   |        |      |             |     |                                 |
| Snippet Shortcuts          | Complete   |        |      |             |     | Quick access via /              |
| Snippet Search             | Complete   |        |      |             |     |                                 |
| Snippet Folders            | Complete   |        |      |             |     | Organization via contentFolders |

## 1.6 Product Tours

| Feature                                           | Dev Status | Manual | Unit | Integration | E2E | Notes                         |
| ------------------------------------------------- | ---------- | ------ | ---- | ----------- | --- | ----------------------------- |
| Tour List                                         | Complete   |        |      |             | ✓   | `apps/web/src/app/tours`      |
| Tour Create/Edit/Delete                           | Complete   |        |      |             | ✓   |                               |
| Tour Status (Draft/Active/Archived)               | Complete   |        |      |             | ✓   |                               |
| Tour Duplicate                                    | Complete   |        |      |             | ✓   |                               |
| Tour Activate/Deactivate                          | Complete   |        |      |             | ✓   |                               |
| Tour Detail Editor                                | Complete   |        |      |             | ✓   | `apps/web/src/app/tours/[id]` |
| Pointer Steps                                     | Complete   |        |      |             | ✓   | Element highlighting          |
| Post Steps (Modal)                                | Complete   |        |      |             | ✓   |                               |
| Video Steps                                       | Complete   |        |      |             | ✓   |                               |
| Step Ordering                                     | Complete   |        |      |             | ✓   |                               |
| Element Selector                                  | Complete   |        |      |             | ✓   | CSS selector targeting        |
| Step Position (Auto/Left/Right/Above/Below)       | Complete   |        |      |             | ✓   |                               |
| Step Size (Small/Large)                           | Complete   |        |      |             | ✓   |                               |
| Advance Triggers (Click/Element Click/Field Fill) | Complete   |        |      |             | ✓   |                               |
| Custom Button Text                                | Complete   |        |      |             | ✓   |                               |
| Media Upload (Image/Video)                        | Complete   |        |      |             | ✓   |                               |
| WYSIWYG Authoring Mode                            | Complete   |        |      |             | ✓   | Visual tour builder           |
| Authoring Sessions                                | Complete   |        |      |             | ✓   | Token-based editing           |
| Audience Targeting Rules                          | Complete   |        |      |             |     |                               |
| Display Mode (First Time/Until Dismissed)         | Complete   |        |      |             |     |                               |
| Tour Priority                                     | Complete   |        |      |             |     |                               |
| Button Color Customization                        | Complete   |        |      |             |     |                               |
| Sender Avatar                                     | Complete   |        |      |             |     |                               |
| Confetti on Completion                            | Complete   |        |      |             |     |                               |
| Snooze/Restart Options                            | Complete   |        |      |             |     |                               |
| Tour Progress Tracking                            | Complete   |        |      |             |     |                               |

## 1.7 Tooltips

| Feature                         | Dev Status | Manual | Unit | Integration | E2E | Notes                           |
| ------------------------------- | ---------- | ------ | ---- | ----------- | --- | ------------------------------- |
| Tooltip List                    | Complete   |        |      |             | ✓   | `apps/web/src/app/tooltips`     |
| Tooltip Create/Edit/Delete      | Complete   |        |      |             | ✓   |                                 |
| Element Selector                | Complete   |        |      |             | ✓   |                                 |
| Trigger Type (Hover/Click/Auto) | Complete   |        |      |             | ✓   |                                 |
| Audience Targeting              | Complete   |        |      |             | ✓   |                                 |
| Trigger Configuration           | Complete   |        |      |             | ✓   | Page visit, time, scroll, event |

## 1.8 Outbound Messages

| Feature                                       | Dev Status | Manual | Unit | Integration | E2E | Notes                       |
| --------------------------------------------- | ---------- | ------ | ---- | ----------- | --- | --------------------------- |
| Message List                                  | Complete   |        |      |             | ✓   | `apps/web/src/app/outbound` |
| Chat Messages                                 | Complete   |        |      |             | ✓   | Proactive chat from agent   |
| Post Messages                                 | Complete   |        |      |             | ✓   | Announcement-style          |
| Banner Messages                               | Complete   |        |      |             | ✓   | Inline/floating banners     |
| Message Create/Edit/Delete                    | Complete   |        |      |             | ✓   |                             |
| Message Status (Draft/Active/Paused/Archived) | Complete   |        |      |             | ✓   |                             |
| Audience Targeting Rules                      | Complete   |        |      |             | ✓   |                             |
| Trigger Configuration                         | Complete   |        |      |             | ✓   | Page, time, scroll, event   |
| Frequency Control                             | Complete   |        |      |             | ✓   | Once/per session/always     |
| Scheduling (Start/End Date)                   | Complete   |        |      |             | ✓   |                             |
| Priority                                      | Complete   |        |      |             | ✓   |                             |
| Button Actions (URL/Dismiss/Tour)             | Complete   |        |      |             | ✓   |                             |
| Impression Tracking                           | Complete   |        |      |             | ✓   | Shown/clicked/dismissed     |

## 1.9 Checklists

| Feature                                             | Dev Status | Manual | Unit | Integration | E2E | Notes                         |
| --------------------------------------------------- | ---------- | ------ | ---- | ----------- | --- | ----------------------------- |
| Checklist List                                      | Complete   |        |      |             |     | `apps/web/src/app/checklists` |
| Checklist Create/Edit/Delete                        | Complete   |        |      |             |     |                               |
| Task Items                                          | Complete   |        |      |             |     |                               |
| Task Actions (Tour/URL/Event)                       | Complete   |        |      |             |     |                               |
| Completion Types (Manual/Auto Event/Auto Attribute) | Complete   |        |      |             |     |                               |
| Audience Targeting                                  | Complete   |        |      |             |     |                               |
| Checklist Progress Tracking                         | Complete   |        |      |             |     | Per-visitor progress          |

## 1.10 Surveys

| Feature                     | Dev Status | Manual | Unit | Integration | E2E | Notes                      |
| --------------------------- | ---------- | ------ | ---- | ----------- | --- | -------------------------- |
| Survey List                 | Complete   |        |      |             |     | `apps/web/src/app/surveys` |
| Survey Create/Edit/Delete   | Complete   |        |      |             |     |                            |
| Survey Format (Small/Large) | Complete   |        |      |             |     |                            |
| NPS Questions               | Complete   |        |      |             |     | 0-10 scale                 |
| Numeric Scale Questions     | Complete   |        |      |             |     | Configurable range         |
| Star Rating Questions       | Complete   |        |      |             |     |                            |
| Emoji Rating Questions      | Complete   |        |      |             |     | 3 or 5 emojis              |
| Dropdown Questions          | Complete   |        |      |             |     |                            |
| Short Text Questions        | Complete   |        |      |             |     |                            |
| Long Text Questions         | Complete   |        |      |             |     |                            |
| Multiple Choice Questions   | Complete   |        |      |             |     |                            |
| Intro Step (Large format)   | Complete   |        |      |             |     |                            |
| Thank You Step              | Complete   |        |      |             |     |                            |
| Progress Bar                | Complete   |        |      |             |     |                            |
| Dismiss Button              | Complete   |        |      |             |     |                            |
| Audience Targeting          | Complete   |        |      |             |     |                            |
| Trigger Configuration       | Complete   |        |      |             |     |                            |
| Frequency Control           | Complete   |        |      |             |     |                            |
| Scheduling                  | Complete   |        |      |             |     |                            |
| Response Collection         | Complete   |        |      |             |     |                            |
| Store as Visitor Attribute  | Complete   |        |      |             |     |                            |
| Survey Analytics            | Partial    |        |      |             |     | Basic response viewing     |

## 1.11 Tickets

| Feature                                                | Dev Status | Manual | Unit | Integration | E2E | Notes                                              |
| ------------------------------------------------------ | ---------- | ------ | ---- | ----------- | --- | -------------------------------------------------- |
| Ticket List                                            | Complete   |        |      |             | ✓   | `apps/web/src/app/tickets`                         |
| Ticket Detail View                                     | Complete   |        |      |             | ✓   | `apps/web/src/app/tickets/[id]`                    |
| Ticket Create                                          | Complete   |        |      |             | ✓   |                                                    |
| Ticket Status (Submitted/In Progress/Waiting/Resolved) | Complete   |        |      |             | ✓   |                                                    |
| Ticket Priority (Low/Normal/High/Urgent)               | Complete   |        |      |             | ✓   |                                                    |
| Ticket Assignment                                      | Complete   |        |      |             | ✓   |                                                    |
| Ticket Comments                                        | Complete   |        |      |             | ✓   |                                                    |
| Internal Notes                                         | Complete   |        |      |             | ✓   |                                                    |
| Convert from Conversation                              | Complete   |        |      |             |     |                                                    |
| Resolution Summary                                     | Complete   |        |      |             | ✓   |                                                    |
| Ticket Forms                                           | Complete   |        |      |             | ✓   | `apps/web/src/app/tickets/forms`                   |
| Custom Form Fields                                     | Complete   |        |      |             | ✓   | Text, textarea, select, multi-select, number, date |
| Default Form                                           | Complete   |        |      |             | ✓   |                                                    |

## 1.12 Campaigns

| Feature                                                     | Dev Status | Manual | Unit | Integration | E2E | Notes                                  |
| ----------------------------------------------------------- | ---------- | ------ | ---- | ----------- | --- | -------------------------------------- |
| Campaign Dashboard                                          | Complete   |        |      |             |     | `apps/web/src/app/campaigns`           |
| Email Campaigns                                             | Complete   |        |      |             |     | `apps/web/src/app/campaigns/email`     |
| Email Campaign Create/Edit                                  | Complete   |        |      |             |     |                                        |
| Email Subject/Preview Text                                  | Complete   |        |      |             |     |                                        |
| Email Content Editor                                        | Complete   |        |      |             |     |                                        |
| Email Templates                                             | Complete   |        |      |             |     |                                        |
| Email Audience Targeting                                    | Complete   |        |      |             |     |                                        |
| Email Scheduling                                            | Complete   |        |      |             |     | Immediate/scheduled                    |
| Email Stats (Sent/Delivered/Opened/Clicked/Bounced)         | Complete   |        |      |             |     |                                        |
| Push Campaigns                                              | Complete   |        |      |             |     | `apps/web/src/app/campaigns/push`      |
| Push Title/Body                                             | Complete   |        |      |             |     |                                        |
| Push Image                                                  | Complete   |        |      |             |     |                                        |
| Push Deep Link                                              | Complete   |        |      |             |     |                                        |
| Push Audience Targeting                                     | Complete   |        |      |             |     |                                        |
| Push Scheduling                                             | Complete   |        |      |             |     |                                        |
| Push Stats                                                  | Complete   |        |      |             |     |                                        |
| Mobile Carousels                                            | Complete   |        |      |             |     | `apps/web/src/app/campaigns/carousels` |
| Carousel Screens                                            | Complete   |        |      |             |     | Multi-page swipeable                   |
| Carousel Buttons                                            | Complete   |        |      |             |     | URL/dismiss/next/deeplink              |
| Carousel Targeting                                          | Complete   |        |      |             |     |                                        |
| Series (Campaign Orchestration)                             | Complete   |        |      |             |     | `apps/web/src/app/campaigns/series`    |
| Series Visual Builder                                       | Complete   |        |      |             |     |                                        |
| Series Blocks (Rule/Wait/Email/Push/Chat/Post/Carousel/Tag) | Complete   |        |      |             |     |                                        |
| Series Connections                                          | Complete   |        |      |             |     | Conditional branching                  |
| Series Entry/Exit/Goal Rules                                | Complete   |        |      |             |     |                                        |
| Series Progress Tracking                                    | Complete   |        |      |             |     |                                        |

## 1.13 Segments

| Feature                      | Dev Status | Manual | Unit | Integration | E2E | Notes                       |
| ---------------------------- | ---------- | ------ | ---- | ----------- | --- | --------------------------- |
| Segment List                 | Complete   |        |      |             |     | `apps/web/src/app/segments` |
| Segment Create/Edit/Delete   | Complete   |        |      |             |     |                             |
| Audience Rule Builder        | Complete   |        |      |             |     | Reusable across features    |
| Visitor Attributes Filtering | Complete   |        |      |             |     |                             |
| Event-based Filtering        | Complete   |        |      |             |     |                             |
| Device/Location Filtering    | Complete   |        |      |             |     |                             |

## 1.14 Reports & Analytics

| Feature                    | Dev Status | Manual | Unit | Integration | E2E | Notes                      |
| -------------------------- | ---------- | ------ | ---- | ----------- | --- | -------------------------- |
| Reports Dashboard          | Complete   |        |      |             |     | `apps/web/src/app/reports` |
| Conversations Report       | Complete   |        |      |             |     | Volume, response times     |
| Team Performance Report    | Complete   |        |      |             |     | Agent metrics              |
| CSAT Report                | Complete   |        |      |             |     | Customer satisfaction      |
| AI Agent Report            | Complete   |        |      |             |     | AI performance metrics     |
| Date Range Selection       | Complete   |        |      |             |     |                            |
| Report Snapshots (Caching) | Complete   |        |      |             |     |                            |

## 1.15 Settings

| Feature                                    | Dev Status | Manual | Unit | Integration | E2E | Notes              |
| ------------------------------------------ | ---------- | ------ | ---- | ----------- | --- | ------------------ |
| Workspace Info                             | Complete   |        |      |             | ✓   | Name, ID display   |
| Workspace ID Copy                          | Complete   |        |      |             |     |                    |
| Allowed Origins                            | Complete   |        |      |             |     | CORS configuration |
| Team Members List                          | Complete   |        |      |             | ✓   |                    |
| Invite Team Member                         | Complete   |        |      |             | ✓   | Email invitation   |
| Pending Invitations                        | Complete   |        |      |             |     |                    |
| Role Management (Admin/Agent)              | Complete   |        |      |             | ✓   |                    |
| Remove Member                              | Complete   |        |      |             |     |                    |
| Signup Mode (Invite Only/Domain Allowlist) | Complete   |        |      |             |     |                    |
| Allowed Domains                            | Complete   |        |      |             |     |                    |
| Authentication Methods (Password/OTP)      | Complete   |        |      |             | ✓   |                    |
| Email Channel Enable/Disable               | Complete   |        |      |             |     |                    |
| Email Forwarding Address                   | Complete   |        |      |             |     |                    |
| Email From Name/Address                    | Complete   |        |      |             |     |                    |
| Email Signature                            | Complete   |        |      |             |     |                    |
| Widget Installation Guide                  | Complete   |        |      |             |     |                    |
| Mobile SDK Installation Guide              | Complete   |        |      |             |     |                    |
| Automation Settings                        | Complete   |        |      |             |     |                    |
| Suggest Articles Toggle                    | Complete   |        |      |             |     |                    |
| Show Reply Time Toggle                     | Complete   |        |      |             |     |                    |
| Collect Email Toggle                       | Complete   |        |      |             |     |                    |
| Ask for Rating Toggle                      | Complete   |        |      |             |     |                    |
| AI Agent Settings                          | Complete   |        |      |             |     |                    |
| AI Enable/Disable                          | Complete   |        |      |             |     |                    |
| AI Model Selection                         | Complete   |        |      |             |     |                    |
| AI Knowledge Sources                       | Complete   |        |      |             |     |                    |
| AI Confidence Threshold                    | Complete   |        |      |             |     |                    |
| AI Personality                             | Complete   |        |      |             |     |                    |
| AI Handoff Message                         | Complete   |        |      |             |     |                    |
| AI Suggestions Enable                      | Complete   |        |      |             |     |                    |
| AI Embedding Model                         | Complete   |        |      |             |     |                    |
| Connected Mobile Devices                   | Complete   |        |      |             |     |                    |
| Backend Connection Info                    | Complete   |        |      |             |     |                    |
| Change Backend                             | Complete   |        |      |             |     |                    |

---

# 2. Widget (Embeddable Chat)

## 2.1 Core Chat

| Feature                   | Dev Status | Manual | Unit | Integration | E2E | Notes                                      |
| ------------------------- | ---------- | ------ | ---- | ----------- | --- | ------------------------------------------ |
| Launcher Button           | Complete   |        |      |             |     | Floating chat button                       |
| Unread Badge              | Complete   |        |      |             |     |                                            |
| Open/Close Widget         | Complete   |        |      |             |     |                                            |
| Conversation List View    | Complete   |        |      |             |     |                                            |
| Conversation Detail View  | Complete   |        |      |             |     |                                            |
| Send Messages             | Complete   |        |      |             |     |                                            |
| Real-time Message Updates | Complete   |        |      |             |     |                                            |
| Session Persistence       | Complete   |        |      |             |     | localStorage session ID                    |
| Signed Session Tokens     | Complete   |        |      |             |     | `widgetSessions:boot` returns `wst_` token |
| Visitor Creation          | Complete   |        |      |             |     | Auto-create on first message               |
| Device Detection          | Complete   |        |      |             |     | Browser, OS, device type                   |
| Location Detection        | Complete   |        |      |             |     | Via IP geolocation                         |
| Referrer Tracking         | Complete   |        |      |             |     |                                            |
| Current URL Tracking      | Complete   |        |      |             |     |                                            |
| Mark as Read              | Complete   |        |      |             |     |                                            |
| Heartbeat (Presence)      | Complete   |        |      |             |     | Online status                              |

## 2.2 Visitor Identification

| Feature              | Dev Status | Manual | Unit | Integration | E2E | Notes                                    |
| -------------------- | ---------- | ------ | ---- | ----------- | --- | ---------------------------------------- |
| Signed Session Auth  | Complete   |        |      | ✓           |     | All visitor calls require `sessionToken` |
| Anonymous Visitors   | Complete   |        |      |             |     | Session-based                            |
| Identify API         | Complete   |        |      |             |     | `Opencom.identify()`                     |
| Email Capture Prompt | Complete   |        |      |             |     |                                          |
| Custom Attributes    | Complete   |        |      |             |     |                                          |
| External User ID     | Complete   |        |      |             |     |                                          |

## 2.3 Self-Service

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes               |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | ------------------- |
| Article Search           | Complete   |        |      |             |     | In-widget search    |
| Article Detail View      | Complete   |        |      |             |     |                     |
| Article Feedback         | Complete   |        |      |             |     | Helpful/not helpful |
| Article Suggestions (AI) | Complete   |        |      |             |     | While typing        |
| Common Issue Buttons     | Complete   |        |      |             |     | Quick actions       |

## 2.4 AI Agent

| Feature                           | Dev Status | Manual | Unit | Integration | E2E | Notes                  |
| --------------------------------- | ---------- | ------ | ---- | ----------- | --- | ---------------------- |
| AI Auto-Response                  | Complete   |        |      |             |     |                        |
| AI Typing Indicator               | Complete   |        |      |             |     |                        |
| AI Response Sources               | Complete   |        |      |             |     | Show knowledge sources |
| AI Feedback (Helpful/Not Helpful) | Complete   |        |      |             |     |                        |
| AI Handoff to Human               | Complete   |        |      |             |     |                        |
| AI Confidence Display             | Complete   |        |      |             |     |                        |

## 2.5 Product Tours

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes                 |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | --------------------- |
| Tour Overlay            | Complete   |        |      |             |     | `TourOverlay.tsx`     |
| Pointer Steps           | Complete   |        |      |             |     | Element highlighting  |
| Post Steps              | Complete   |        |      |             |     | Modal display         |
| Video Steps             | Complete   |        |      |             |     |                       |
| Step Navigation         | Complete   |        |      |             |     | Next/Previous/Skip    |
| Progress Indicator      | Complete   |        |      |             |     |                       |
| Auto-show Tours         | Complete   |        |      |             |     | Based on targeting    |
| Tour Picker View        | Complete   |        |      |             |     | Manual tour selection |
| Tour Progress Tracking  | Complete   |        |      |             |     |                       |
| Tour Snooze             | Complete   |        |      |             |     |                       |
| Tour Restart            | Complete   |        |      |             |     |                       |
| Confetti Animation      | Complete   |        |      |             |     |                       |
| Start Tour API          | Complete   |        |      |             |     | `Opencom.startTour()` |
| Get Available Tours API | Complete   |        |      |             |     |                       |

## 2.6 Authoring Mode

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes                  |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | ---------------------- |
| Authoring Overlay        | Complete   |        |      |             |     | `AuthoringOverlay.tsx` |
| Element Selection        | Complete   |        |      |             |     | Visual element picker  |
| Step Preview             | Complete   |        |      |             |     |                        |
| Step Configuration       | Complete   |        |      |             |     |                        |
| Save Step                | Complete   |        |      |             |     |                        |
| Session Token Validation | Complete   |        |      |             |     |                        |

## 2.7 Tooltips

| Feature            | Dev Status | Manual | Unit | Integration | E2E | Notes                |
| ------------------ | ---------- | ------ | ---- | ----------- | --- | -------------------- |
| Tooltip Overlay    | Complete   |        |      |             |     | `TooltipOverlay.tsx` |
| Hover Trigger      | Complete   |        |      |             |     |                      |
| Click Trigger      | Complete   |        |      |             |     |                      |
| Auto Trigger       | Complete   |        |      |             |     |                      |
| Audience Targeting | Complete   |        |      |             |     |                      |

## 2.8 Outbound Messages

| Feature             | Dev Status | Manual | Unit | Integration | E2E | Notes                 |
| ------------------- | ---------- | ------ | ---- | ----------- | --- | --------------------- |
| Outbound Overlay    | Complete   |        |      |             |     | `OutboundOverlay.tsx` |
| Chat Messages       | Complete   |        |      |             |     |                       |
| Post Messages       | Complete   |        |      |             |     |                       |
| Banner Messages     | Complete   |        |      |             |     |                       |
| Trigger Evaluation  | Complete   |        |      |             |     |                       |
| Frequency Control   | Complete   |        |      |             |     |                       |
| Impression Tracking | Complete   |        |      |             |     |                       |

## 2.9 Checklists

| Feature           | Dev Status | Manual | Unit | Integration | E2E | Notes                  |
| ----------------- | ---------- | ------ | ---- | ----------- | --- | ---------------------- |
| Checklist Overlay | Complete   |        |      |             |     | `ChecklistOverlay.tsx` |
| Checklist View    | Complete   |        |      |             |     | In-widget display      |
| Task Completion   | Complete   |        |      |             |     |                        |
| Task Actions      | Complete   |        |      |             |     | Launch tour, open URL  |
| Progress Tracking | Complete   |        |      |             |     |                        |

## 2.10 Surveys

| Feature                   | Dev Status | Manual | Unit | Integration | E2E | Notes                   |
| ------------------------- | ---------- | ------ | ---- | ----------- | --- | ----------------------- |
| Survey Overlay            | Complete   |        |      |             |     | `SurveyOverlay.tsx`     |
| Small Format              | Complete   |        |      |             |     | Compact display         |
| Large Format              | Complete   |        |      |             |     | Full-screen             |
| All Question Types        | Complete   |        |      |             |     | NPS, rating, text, etc. |
| Response Submission       | Complete   |        |      |             |     |                         |
| Partial Response Tracking | Complete   |        |      |             |     |                         |

## 2.11 CSAT

| Feature           | Dev Status | Manual | Unit | Integration | E2E | Notes            |
| ----------------- | ---------- | ------ | ---- | ----------- | --- | ---------------- |
| CSAT Prompt       | Complete   |        |      |             |     | `CsatPrompt.tsx` |
| Rating Collection | Complete   |        |      |             |     |                  |
| Feedback Text     | Complete   |        |      |             |     |                  |

## 2.12 Tickets

| Feature               | Dev Status | Manual | Unit | Integration | E2E | Notes |
| --------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Ticket List View      | Complete   |        |      |             |     |       |
| Ticket Detail View    | Complete   |        |      |             |     |       |
| Ticket Create         | Complete   |        |      |             |     |       |
| Ticket Form Rendering | Complete   |        |      |             |     |       |
| Ticket Comments       | Complete   |        |      |             |     |       |

## 2.13 Events & Tracking

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes             |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | ----------------- |
| Track Event API         | Complete   |        |      |             |     | `Opencom.track()` |
| Page View Tracking      | Complete   |        |      |             |     | Auto-track option |
| Session Events          | Complete   |        |      |             |     | Start/end         |
| Custom Event Properties | Complete   |        |      |             |     |                   |

---

# 3. Mobile App (Admin/Agent)

## 3.1 Authentication

| Feature              | Dev Status | Manual | Unit | Integration | E2E | Notes                    |
| -------------------- | ---------- | ------ | ---- | ----------- | --- | ------------------------ |
| Login Screen         | Complete   |        |      |             |     | `apps/mobile/app/(auth)` |
| Email/Password Login | Complete   |        |      |             |     |                          |
| OTP Login            | Complete   |        |      |             |     |                          |
| Logout               | Complete   |        |      |             |     |                          |
| Session Persistence  | Complete   |        |      |             |     |                          |

## 3.2 Inbox

| Feature             | Dev Status | Manual | Unit | Integration | E2E | Notes                                |
| ------------------- | ---------- | ------ | ---- | ----------- | --- | ------------------------------------ |
| Conversation List   | Complete   |        |      |             |     | `apps/mobile/app/(app)/index.tsx`    |
| Conversation Detail | Complete   |        |      |             |     | `apps/mobile/app/(app)/conversation` |
| Send Messages       | Complete   |        |      |             |     |                                      |
| Real-time Updates   | Complete   |        |      |             |     |                                      |
| Unread Indicators   | Complete   |        |      |             |     |                                      |
| Pull to Refresh     | Complete   |        |      |             |     |                                      |

## 3.3 Push Notifications

| Feature                   | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ------------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Push Token Registration   | Complete   |        |      |             |     |       |
| New Message Notifications | Complete   |        |      |             |     |       |
| Notification Handling     | Complete   |        |      |             |     |       |
| Badge Count               | Complete   |        |      |             |     |       |

## 3.4 Settings

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes                                |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | ------------------------------------ |
| Settings Screen          | Complete   |        |      |             |     | `apps/mobile/app/(app)/settings.tsx` |
| Notification Preferences | Complete   |        |      |             |     |                                      |
| Workspace Switching      | Complete   |        |      |             |     |                                      |
| Account Info             | Complete   |        |      |             |     |                                      |

---

# 4. Mobile SDKs

## 4.1 React Native SDK

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes                                           |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | ----------------------------------------------- |
| SDK Initialization      | Complete   |        | ✓    |             |     | `packages/react-native-sdk`                     |
| OpencomProvider         | Complete   |        | ✓    |             |     | React context provider                          |
| OpencomLauncher         | Complete   |        | ✓    |             |     | Floating button component                       |
| Signed Session Auth     | Complete   |        |      |             |     | All hooks thread `sessionToken` + `workspaceId` |
| Identify API            | Complete   |        | ✓    |             |     |                                                 |
| Track Event API         | Complete   |        | ✓    |             |     |                                                 |
| Push Token Registration | Complete   |        | ✓    |             |     |                                                 |
| Expo Plugin             | Complete   |        |      |             |     | Auto-configuration                              |
| Messenger UI            | Complete   |        |      |             |     |                                                 |
| Home Screen             | Complete   |        |      |             |     | Conversations, articles, search                 |
| Ticket Create           | Complete   |        |      |             |     |                                                 |
| Carousels Display       | Complete   |        |      |             |     |                                                 |

## 4.2 iOS SDK (Swift)

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes                                                |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | ---------------------------------------------------- |
| SDK Initialization      | Complete   |        |      |             |     | `packages/ios-sdk`                                   |
| Signed Session Auth     | Complete   |        |      |             |     | `SessionManager` stores token; API client threads it |
| Identify API            | Complete   |        |      |             |     |                                                      |
| Track Event API         | Complete   |        |      |             |     |                                                      |
| Push Token Registration | Complete   |        |      |             |     |                                                      |
| Messenger Presentation  | Complete   |        |      |             |     |                                                      |
| SwiftUI Support         | Complete   |        |      |             |     |                                                      |
| UIKit Support           | Complete   |        |      |             |     |                                                      |
| CocoaPods Distribution  | Complete   |        |      |             |     |                                                      |
| Swift Package Manager   | Complete   |        |      |             |     |                                                      |

## 4.3 Android SDK (Kotlin)

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes                                                |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | ---------------------------------------------------- |
| SDK Initialization      | Complete   |        |      |             |     | `packages/android-sdk`                               |
| Signed Session Auth     | Complete   |        |      |             |     | `SessionManager` stores token; API client threads it |
| Identify API            | Complete   |        |      |             |     |                                                      |
| Track Event API         | Complete   |        |      |             |     |                                                      |
| Push Token Registration | Complete   |        |      |             |     |                                                      |
| Messenger Activity      | Complete   |        |      |             |     |                                                      |
| Jetpack Compose Support | Complete   |        |      |             |     | Compose-based messenger UI                           |
| Maven Distribution      | Partial    |        |      |             |     |                                                      |

---

# 5. Backend (Convex)

## 5.1 Core Data Models

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes                                  |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | -------------------------------------- |
| Workspaces               | Complete   |        |      | ✓           |     | Multi-tenant isolation                 |
| Users (Agents)           | Complete   |        |      | ✓           |     |                                        |
| Workspace Members        | Complete   |        |      | ✓           |     |                                        |
| Workspace Invitations    | Complete   |        |      | ✓           |     |                                        |
| Auth Sessions            | Complete   |        |      | ✓           |     |                                        |
| OTP Codes                | Complete   |        |      | ✓           |     |                                        |
| Visitors                 | Complete   |        |      | ✓           |     |                                        |
| Conversations            | Complete   |        |      | ✓           |     |                                        |
| Messages                 | Complete   |        |      | ✓           |     |                                        |
| Push Tokens              | Complete   |        |      | ✓           |     |                                        |
| Visitor Push Tokens      | Complete   |        |      | ✓           |     |                                        |
| Notification Preferences | Complete   |        |      | ✓           |     |                                        |
| Widget Sessions          | Complete   |        |      | ✓           |     | Signed session tokens for visitor auth |

## 5.2 Help Center

| Feature              | Dev Status | Manual | Unit | Integration | E2E | Notes |
| -------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Collections          | Complete   |        |      |             |     |       |
| Articles             | Complete   |        |      |             |     |       |
| Article Feedback     | Complete   |        |      |             |     |       |
| Article Search Index | Complete   |        |      |             |     |       |

## 5.3 Knowledge Hub

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Content Folders         | Complete   |        |      | ✓           |     |       |
| Internal Articles       | Complete   |        |      | ✓           |     |       |
| Internal Article Search | Complete   |        |      | ✓           |     |       |
| Snippets                | Complete   |        |      | ✓           |     |       |
| Recent Content Access   | Complete   |        |      | ✓           |     |       |

## 5.4 Product Tours

| Feature            | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ------------------ | ---------- | ------ | ---- | ----------- | --- | ----- |
| Tours              | Complete   |        |      | ✓           |     |       |
| Tour Steps         | Complete   |        |      | ✓           |     |       |
| Tour Progress      | Complete   |        |      | ✓           |     |       |
| Authoring Sessions | Complete   |        |      | ✓           |     |       |
| Tooltips           | Complete   |        |      | ✓           |     |       |

## 5.5 Outbound

| Feature              | Dev Status | Manual | Unit | Integration | E2E | Notes |
| -------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Outbound Messages    | Complete   |        |      | ✓           |     |       |
| Outbound Impressions | Complete   |        |      | ✓           |     |       |
| Checklists           | Complete   |        |      | ✓           |     |       |
| Checklist Progress   | Complete   |        |      | ✓           |     |       |

## 5.6 Surveys

| Feature            | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ------------------ | ---------- | ------ | ---- | ----------- | --- | ----- |
| Surveys            | Complete   |        |      | ✓           |     |       |
| Survey Responses   | Complete   |        |      | ✓           |     |       |
| Survey Impressions | Complete   |        |      | ✓           |     |       |

## 5.7 Tickets

| Feature         | Dev Status | Manual | Unit | Integration | E2E | Notes |
| --------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Tickets         | Complete   |        |      | ✓           |     |       |
| Ticket Comments | Complete   |        |      | ✓           |     |       |
| Ticket Forms    | Complete   |        |      | ✓           |     |       |

## 5.8 Campaigns

| Feature                   | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ------------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Email Campaigns           | Complete   |        |      | ✓           |     |       |
| Email Templates           | Complete   |        |      | ✓           |     |       |
| Email Campaign Recipients | Complete   |        |      | ✓           |     |       |
| Push Campaigns            | Complete   |        |      |             |     |       |
| Push Campaign Recipients  | Complete   |        |      |             |     |       |
| Carousels                 | Complete   |        |      | ✓           |     |       |
| Carousel Impressions      | Complete   |        |      | ✓           |     |       |
| Series                    | Complete   |        |      | ✓           |     |       |
| Series Blocks             | Complete   |        |      | ✓           |     |       |
| Series Connections        | Complete   |        |      | ✓           |     |       |
| Series Progress           | Complete   |        |      | ✓           |     |       |
| Series Progress History   | Complete   |        |      | ✓           |     |       |

## 5.9 Email Channel

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes        |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | ------------ |
| Email Configs            | Complete   |        |      | ✓           |     |              |
| Email Threads            | Complete   |        |      | ✓           |     |              |
| Inbound Email Processing | Complete   |        |      | ✓           |     | HTTP webhook |
| Outbound Email Sending   | Complete   |        |      | ✓           |     |              |

## 5.10 AI Agent

| Feature             | Dev Status | Manual | Unit | Integration | E2E | Notes                   |
| ------------------- | ---------- | ------ | ---- | ----------- | --- | ----------------------- |
| AI Agent Settings   | Complete   |        |      | ✓           |     |                         |
| AI Responses        | Complete   |        |      | ✓           |     |                         |
| Content Embeddings  | Complete   |        |      | ✓           |     | Vector search           |
| Suggestion Feedback | Complete   |        |      | ✓           |     |                         |
| Multi-model Support | Complete   |        |      | ✓           |     | OpenAI, Anthropic, etc. |

## 5.11 Automation

| Feature              | Dev Status | Manual | Unit | Integration | E2E | Notes |
| -------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Automation Settings  | Complete   |        |      | ✓           |     |       |
| Assignment Rules     | Complete   |        |      | ✓           |     |       |
| Auto-Tag Rules       | Complete   |        |      | ✓           |     |       |
| Tags                 | Complete   |        |      | ✓           |     |       |
| Conversation Tags    | Complete   |        |      | ✓           |     |       |
| Office Hours         | Complete   |        |      | ✓           |     |       |
| Common Issue Buttons | Complete   |        |      | ✓           |     |       |

## 5.12 Segments & Targeting

| Feature               | Dev Status | Manual | Unit | Integration | E2E | Notes |
| --------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Segments              | Complete   |        |      | ✓           |     |       |
| Audience Rules Engine | Complete   |        |      | ✓           |     |       |
| Visitor Events        | Complete   |        |      | ✓           |     |       |

## 5.13 Reporting

| Feature              | Dev Status | Manual | Unit | Integration | E2E | Notes |
| -------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| CSAT Responses       | Complete   |        |      | ✓           |     |       |
| Report Snapshots     | Complete   |        |      | ✓           |     |       |
| Conversation Metrics | Complete   |        |      | ✓           |     |       |
| Agent Metrics        | Complete   |        |      | ✓           |     |       |
| AI Metrics           | Complete   |        |      | ✓           |     |       |

## 5.14 HTTP API

| Feature                   | Dev Status | Manual | Unit | Integration | E2E | Notes                |
| ------------------------- | ---------- | ------ | ---- | ----------- | --- | -------------------- |
| Discovery Endpoint        | Complete   |        |      |             |     |                      |
| Email Webhook             | Complete   |        |      |             |     |                      |
| Push Notification Sending | Complete   |        |      |             |     |                      |
| CORS Origin Validation    | Complete   |        |      |             |     | No wildcard fallback |
| Geolocation (HTTPS)       | Complete   |        |      |             |     | ip-api.com via HTTPS |

## 5.15 Security & Authorization

| Feature                          | Dev Status | Manual | Unit | Integration | E2E | Notes                                                |
| -------------------------------- | ---------- | ------ | ---- | ----------- | --- | ---------------------------------------------------- |
| RBAC Permission System           | Complete   |        |      | ✓           |     | Owner/Admin/Agent/Viewer roles                       |
| Conversation Auth (Agent Path)   | Complete   |        |      |             |     | `conversations.read` permission                      |
| Conversation Auth (Visitor Path) | Complete   |        |      |             |     | Visitor ownership check                              |
| Bot Message Restriction          | Complete   |        |      |             |     | Internal-only via `internalSendBotMessage`           |
| Workspace Data Protection        | Complete   |        |      |             |     | Non-sensitive fields for unauthenticated             |
| Visitor Data Protection          | Complete   |        |      |             |     | Agent membership or session ownership                |
| Signed Session Tokens            | Complete   |        |      | ✓           |     | `widgetSessions:boot`, `resolveVisitorFromSession()` |
| Session Token Expiry & Refresh   | Complete   |        |      |             |     | 24h default, configurable 1h-7d, auto-refresh at 25% |
| AI Settings Protection           | Complete   |        |      |             |     | Workspace membership required                        |
| Test Data Env Guard              | Complete   |        |      |             |     | `ALLOW_TEST_DATA` env var                            |
| CORS Hardening                   | Complete   |        |      |             |     | No wildcard, Vary: Origin                            |
| Auth Callback Optimization       | Complete   |        |      |             |     | Index-based lookups                                  |
| Identity Verification (HMAC)     | Complete   |        |      | ✓           |     | Widget identity verification                         |
| Webhook Signature Verification   | Complete   |        |      |             |     | Resend SVIX signatures                               |
| Audit Logging                    | Complete   |        |      | ✓           |     | Security event tracking                              |
| Password Hash Migration          | Complete   |        |      |             |     | `removePasswordHash` migration                       |

---

# 6. Shared Packages

## 6.1 UI Components (@opencom/ui)

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Button                  | Complete   |        |      |             |     |       |
| Card                    | Complete   |        |      |             |     |       |
| Input                   | Complete   |        |      |             |     |       |
| Other Shadcn Components | Complete   |        |      |             |     |       |

## 6.2 Types (@opencom/types)

| Feature                 | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ----------------------- | ---------- | ------ | ---- | ----------- | --- | ----- |
| Shared Type Definitions | Complete   |        |      |             |     |       |

## 6.3 SDK Core (@opencom/sdk-core)

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes                                                     |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | --------------------------------------------------------- |
| Shared SDK Logic         | Complete   |        |      |             |     |                                                           |
| Session Token Threading  | Complete   |        |      |             |     | `markAsRead`, `addTicketComment` pass `sessionToken`      |
| Visitor State Management | Complete   |        |      |             |     | `getVisitorState()` provides `visitorId` + `sessionToken` |

---

# 7. Infrastructure & DevOps

## 7.1 Testing Infrastructure

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes                   |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | ----------------------- |
| Vitest Configuration     | Complete   |        |      |             |     |                         |
| Playwright Configuration | Complete   |        |      |             |     |                         |
| Convex Test Framework    | Complete   |        |      |             |     |                         |
| E2E Test Suite           | Partial    |        |      |             |     | `apps/web/e2e`          |
| Convex Backend Tests     | Partial    |        |      |             |     | `packages/convex/tests` |

## 7.2 Build & Deploy

| Feature                  | Dev Status | Manual | Unit | Integration | E2E | Notes |
| ------------------------ | ---------- | ------ | ---- | ----------- | --- | ----- |
| PNPM Workspace           | Complete   |        |      |             |     |       |
| TypeScript Configuration | Complete   |        |      |             |     |       |
| ESLint Configuration     | Complete   |        |      |             |     |       |
| Prettier Configuration   | Complete   |        |      |             |     |       |
| Next.js Build            | Complete   |        |      |             |     |       |
| Vite Build (Widget)      | Complete   |        |      |             |     |       |
| Expo Build               | Complete   |        |      |             |     |       |

## 7.3 Documentation

| Feature                    | Dev Status | Manual | Unit | Integration | E2E | Notes                                         |
| -------------------------- | ---------- | ------ | ---- | ----------- | --- | --------------------------------------------- |
| README                     | Complete   |        |      |             |     |                                               |
| Testing Documentation      | Complete   |        |      |             |     | `docs/testing.md`                             |
| SDK READMEs                | Complete   |        |      |             |     |                                               |
| Operational Readiness Docs | Complete   |        |      |             |     | `docs/open-source/security-and-operations.md` |

---

# Summary Statistics

## By Application

| Application      | Total Features | Complete | Partial | In Progress | Planned |
| ---------------- | -------------- | -------- | ------- | ----------- | ------- |
| Web App          | ~180           | ~175     | ~3      | ~0          | ~2      |
| Widget           | ~65            | ~65      | ~0      | ~0          | ~0      |
| Mobile App       | ~15            | ~15      | ~0      | ~0          | ~0      |
| React Native SDK | ~9             | ~9       | ~0      | ~0          | ~0      |
| iOS SDK          | ~9             | ~9       | ~0      | ~0          | ~0      |
| Android SDK      | ~8             | ~7       | ~0      | ~0          | ~1      |
| Backend          | ~90            | ~90      | ~0      | ~0          | ~0      |
| Infrastructure   | ~12            | ~10      | ~2      | ~0          | ~0      |

## Testing Coverage Summary

| Category          | With Unit Tests | With Integration Tests                | With E2E Tests        |
| ----------------- | --------------- | ------------------------------------- | --------------------- |
| Backend Functions | 0               | 43 test files                         | 0                     |
| Backend Security  | 0               | 3 test files (permissions, migration) | 0                     |
| Web App Pages     | 0               | 0                                     | 10 spec files         |
| Widget Components | 0               | 0                                     | 1 spec file (skipped) |
| Mobile App        | 0               | 0                                     | 0                     |
| SDKs              | 3 test files    | 0                                     | 0                     |

---

# Critical Testing Gaps

## High Priority (No Test Coverage)

- Mobile App (all features) - No E2E or unit tests
- Widget Components - E2E tests exist but are skipped
- iOS SDK - No unit tests
- Android SDK - No tests (SDK is also partially implemented)
- Help Center (Articles, Collections) - No backend integration tests
- Campaigns (Push) - No integration tests
- HTTP API endpoints - No integration tests
- Security authorization checks - Backend security tests exist for conversation auth with signed sessions

## Medium Priority (Partial Coverage)

- Web App unit tests - None exist, only E2E
- Surveys - Backend tests exist, no E2E
- Checklists - Backend tests exist, no E2E
- Reports/Analytics - Backend tests exist, no E2E
- CORS hardening - No tests for origin validation/rejection
- Test data env guard - No tests for `ALLOW_TEST_DATA` gating
- Session token expiry/refresh - No automated tests for token lifecycle

---

# Maintenance Process

## Updating This Document

1. **When to update**: After each release or when significant features are added/modified
2. **Who updates**: The team owner for each section (see Ownership table above)
3. **What to update**:
   - Add new features with their development status
   - Update testing status columns when tests are added
   - Move features between status categories as development progresses

## Review Cadence

- **Weekly**: Quick scan for accuracy during sprint planning
- **Monthly**: Full review of testing coverage gaps
- **Quarterly**: Comprehensive audit with stakeholders

---

# Test Coverage Automation

## Running Coverage Reports

```bash
# Run all tests with coverage
pnpm test:ci

# Run Convex integration tests
cd packages/convex && pnpm test

# Run E2E tests
pnpm test:e2e

# Run E2E tests with specific tag
pnpm test:e2e --grep "@tours"
```

## Automated Coverage Tracking

To generate a test coverage report mapped to features:

```bash
# Generate Vitest coverage report
pnpm test:ci --coverage

# List all test files
find . -name "*.test.ts" -o -name "*.spec.ts" | grep -v node_modules

# Count tests per area
grep -r "describe\|it\|test" packages/convex/tests --include="*.test.ts" | wc -l
```

## CI Integration

The CI pipeline runs:

1. `pnpm test:ci` - All unit and integration tests with coverage
2. `pnpm test:e2e` - Playwright E2E tests

Coverage reports are generated in:

- `coverage/` - Vitest coverage output
- `playwright-report/` - Playwright test results

## Future Automation Ideas

1. **Automated feature-to-test mapping**: Script to parse test files and map to features in this document
2. **Coverage badges**: Add coverage badges to README per package
3. **PR checks**: Require test coverage for new features
4. **Dashboard**: Build a simple dashboard showing coverage trends over time
