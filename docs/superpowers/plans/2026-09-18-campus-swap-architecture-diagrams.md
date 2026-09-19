# CampusSwap Architecture Diagrams Plan

> Status: Approved planning baseline. This document defines the implementation
> work; diagram creation and tool installation remain later tasks.
>
> Primary output directory: `docs/diagrams/`
>
> Audience: human developers, reviewers, and AI agents working in CampusSwap.

## 1. Goal

Create a maintainable, version-controlled diagram set for CampusSwap that
explains the approved architecture, domain workflows, data relationships,
security boundaries, privacy behavior, and local deployment topology.

The diagram set has two levels:

1. **Full diagrams**: authoritative, detailed views stored under
   `docs/diagrams/full/`.
2. **Mini diagrams**: intentionally simplified views embedded in `README.md`,
   architecture docs, ADRs, requirements, security docs, and implementation
   plans.

Every diagram must be available as:

- Editable source
- SVG rendering
- PDF rendering

The diagrams must explain important structure and behavior without becoming a
copy of the SQL schema or source tree. Routine attributes such as IDs,
timestamps, password fields, indexes, hashes, and migration metadata are
omitted unless they explain a security, lifecycle, privacy, or authorization
rule.

## 2. Source-of-truth rules

The approved architecture remains the source of truth for technical decisions:

- `docs/architecture/architecture.md`
- `docs/architecture/adr/0001-typescript-fullstack-monolith.md`
- `docs/architecture/adr/0002-mysql-primary-datastore.md`
- `docs/requirements/`
- `docs/security/threat-model.md`
- `docs/testing/test-strategy.md`
- Phase plans under `docs/superpowers/plans/`

The diagrams document the implementation and approved design. They must not
invent:

- Microservices
- A separate public API deployment
- Payment providers
- Email notification delivery
- Mobile applications
- A specific cloud host
- A finalized job runner
- Database fields not needed to explain a relationship or invariant

If the code and a diagram disagree, the implementation task must stop and
record the discrepancy. An AI agent must not silently "correct" the diagram or
the code without identifying which artifact is authoritative.

## 3. Target directory layout

```text
docs/diagrams/
├── README.md
├── diagram-catalog.yml
├── conventions.md
├── full/
│   ├── system-context/
│   │   ├── system-context.mmd
│   │   ├── system-context.svg
│   │   └── system-context.pdf
│   ├── container-architecture/
│   ├── module-dependencies/
│   ├── data-model/
│   ├── exchange-lifecycle/
│   ├── moderation-workflow/
│   ├── review-lifecycle/
│   ├── authorization-boundaries/
│   ├── privacy-retention/
│   └── deployment/
├── mini/
│   ├── README-architecture.mmd
│   ├── ADR-0001-monolith.mmd
│   ├── ADR-0002-storage.mmd
│   ├── requirements-journeys.mmd
│   ├── security-boundaries.mmd
│   └── plans-lifecycle-overview.mmd
├── rendered/
│   ├── svg/
│   └── pdf/
└── tooling/
    ├── render-diagrams.mjs
    ├── validate-diagrams.mjs
    └── diagram-tool-versions.json
```

### Storage policy

- Canonical source lives beside each full diagram.
- Generated SVG and PDF files are committed because they are explicit
  deliverables.
- `docs/diagrams/rendered/` is a normalized publishing directory for links
  that should not depend on tool-specific source paths.
- Temporary renderer caches, Java archives, browser profiles, and generated
  PNG files are not committed.
- If a renderer cannot produce a valid PDF directly, generate SVG first and
  convert SVG to PDF with a documented, pinned conversion tool.

## 4. Tool decision matrix

Use the tool whose notation best expresses the diagram's meaning and produces
the clearest professional output. Do not rewrite the same diagram in multiple
languages without a documented reason.

| Diagram | Primary tool | Why | Secondary option |
|---|---|---|---|
| System context | D2 | Best for composed boundaries, actors, systems, and readable spatial grouping | Mermaid fallback |
| Container architecture | D2 | Best for nested runtime containers and architecture-level composition | Mermaid fallback |
| Module dependencies | Mermaid | Best for a compact dependency graph that embeds in Markdown | D2 if layout becomes dense |
| Data model | PlantUML | Best for conceptual ER notation and relationship cardinality | Mermaid `erDiagram` if PlantUML is less readable |
| Exchange lifecycle | Mermaid | Best native state and sequence notation with easy review | PlantUML if the combined view becomes crowded |
| Moderation workflow | Mermaid | Best for state/flow paths and explicit rejection branches | D2 for a presentation-focused flow |
| Review lifecycle | Mermaid | Best compact state machine with timed reveal branches | PlantUML if state nesting is needed |
| Authorization boundaries | Mermaid | Best for role-to-action flows plus Markdown permission matrix | D2 for a visual trust-boundary view |
| Privacy and retention | Mermaid | Best for timelines and allow/deny decision flows | PlantUML for formal activity notation |
| Deployment | D2 | Best for professional runtime topology and environment boundaries | Mermaid fallback |
| Mini diagrams | Mermaid | Best GitHub-native embedding and lowest reader friction | None by default |

### Tooling principle

Mermaid is the default language for diagrams embedded in Markdown. D2 is used
for system, container, and deployment views where spatial composition materially
improves comprehension. PlantUML is used for the conceptual data model because
its ER notation is the most expressive fit; it may be used for a lifecycle
diagram only when Mermaid cannot keep the full view readable.

This is a quality-based choice, not a preference for one tool. Each diagram
must have one canonical source language, and the catalog records that choice.

This keeps the project from having three competing versions of every diagram.

## 5. Diagram catalog contract

`docs/diagrams/diagram-catalog.yml` is the machine-readable index. Every
diagram entry must contain:

```yaml
id: exchange-lifecycle
title: Exchange lifecycle
kind: workflow
level: full
source:
  path: docs/diagrams/full/exchange-lifecycle/exchange-lifecycle.mmd
  tool: mermaid
outputs:
  svg: docs/diagrams/full/exchange-lifecycle/exchange-lifecycle.svg
  pdf: docs/diagrams/full/exchange-lifecycle/exchange-lifecycle.pdf
audience:
  - developer
  - reviewer
scope:
  includes:
    - proposal states
    - exchange states
    - auto-pause
    - scheduling
  excludes:
    - SQL columns
    - form-level fields
authoritative_docs:
  - docs/architecture/architecture.md
  - docs/superpowers/plans/2026-09-17-phase-2-proposals-exchanges.md
embedded_in:
  - docs/requirements/functional-requirements.md
  - docs/superpowers/plans/2026-09-17-phase-2-proposals-exchanges.md
```

AI agents must update the catalog when adding, renaming, moving, or deleting a
diagram. The validator must reject an unregistered diagram source.

## 6. Diagram conventions

Create `docs/diagrams/conventions.md` before creating the diagram set.

### Visual vocabulary

- Person/actor: human participant
- Rounded process/container: application module or service boundary
- Cylinder: relational datastore
- Dashed boundary: trust, privacy, or deployment boundary
- Solid arrow: runtime dependency or data flow
- Dashed arrow: event, notification, or scheduled action
- Red/warning styling: rejected, denied, hidden, banned, or failed path
- Green/success styling: accepted, completed, published, or resolved path

### Naming

- Use stable IDs such as `system-context`, not dates or branch names.
- Use singular domain names matching the architecture document:
  `identity`, `listings`, `exchanges`, `reputation`, `moderation`,
  `notifications`, and `privacy`.
- Use approved state labels exactly:
  `Draft`, `Active`, `Paused`, `Archived`, `Hidden`, `Proposed`, `Accepted`,
  `Declined`, `Withdrawn`, `Expired`, `Scheduled`, `Completed`, `Cancelled`,
  `Disputed`, `Received`, `Under review`, `Resolved`, `Hidden`, `Published`,
  and `Voided`.

### Detail boundaries

For each full diagram, include only concepts needed to answer its purpose.
Use explanatory Markdown for nuance that would overload the visual.

Every diagram source must include a short metadata comment containing:

- Diagram ID
- Level (`full` or `mini`)
- Primary audience
- Scope
- Explicit omissions
- Source documents

## 7. Full diagram work packages

### 7.1 System context

**Purpose:** Explain the whole product to a new developer or reviewer.

Include visitor/student, authenticated member, moderator, browser, CampusSwap
application, MySQL/MariaDB, file-object boundary, and scheduled jobs.

Show browsing, member mutations, moderation, persistence, and scheduled duties.
Make the modular-monolith boundary explicit.

### 7.2 Container architecture

**Purpose:** Explain runtime/container boundaries.

Include the web tier, session/authentication boundary, domain modules,
repository interfaces, in-memory adapters, MySQL adapter, file-object
boundary, and scheduled jobs.

Show that route components do not access database stores directly and that
domain modules own their invariants.

### 7.3 Module dependencies

**Purpose:** Make coupling visible.

Show the dependency direction described in architecture §2. Include forbidden
dependency notes so future agents do not place business rules in routes,
notifications, or unrelated modules.

### 7.4 Conceptual data model

**Purpose:** Explain domain relationships without duplicating the SQL schema.

Include User, Session, Listing, Proposal, Exchange, Message, Review, Report,
Sanction, Handover, Notification, Audit record, and access/retention records.

Show only lifecycle, ownership, participant, evidence, and audit relationships.
Do not include every field.

### 7.5 Exchange lifecycle

**Purpose:** Explain the core marketplace transaction.

Use a state diagram plus a sequence diagram. Cover proposal cap, expiry, terms
freeze, auto-pause, holds, scheduling, Cairo time, safety acknowledgment,
completion, dispute, cancellation, and notifications.

### 7.6 Moderation workflow

**Purpose:** Explain reporting and enforcement.

Cover report validation, triage states, sanctions, audit records, reporter
notifications, hide/unhide behavior, restrictions, and the stolen-item
hide-first path.

The stolen path must visibly require separate approval and preserve evidence.

### 7.7 Review lifecycle

**Purpose:** Explain blind reviews and reputation.

Cover Completed-only eligibility, bilateral reveal, 14-day reveal, 48-hour
editing, response, aggregation, voiding, and exclusion of voided reviews.

### 7.8 Authorization boundaries

**Purpose:** Explain who may perform which operation.

Pair a role-oriented flow diagram with a concise permission matrix. Include
visitor, member, owner, participant, moderator, approval authority, and
scheduled job.

### 7.9 Privacy and retention

**Purpose:** Explain retention and evidence access.

Cover 12-month messages, 24-month logs, anonymization, deactivation,
case-gated moderator reads, access logging, and evidence preservation.

### 7.10 Deployment

**Purpose:** Explain the current local development topology without implying an
undecided production host.

Show browser, port 3000, Next.js process, MySQL/MariaDB container, volume,
environment configuration, seed command, and scheduled-job boundary. Label
pilot hosting as undecided.

## 8. Mini diagram work packages

Mini diagrams must be readable in a README or section of another document
without requiring the reader to open the full diagram.

Create:

1. **README architecture:** browser → Next.js web tier → domain modules →
   MySQL, with jobs and in-app notifications.
2. **ADR-0001:** one deployable TypeScript modular monolith versus no separate
   API or microservices.
3. **ADR-0002:** domain modules → repository interfaces → MySQL/MariaDB.
4. **Requirements journeys:** browse/publish, proposal/exchange,
   completion/review, report/moderation.
5. **Security boundaries:** visitor/member, member/moderator,
   web/domain, domain/database, moderator/evidence, and upload boundaries.
6. **Phase plan lifecycle overview:** the domain lifecycle and its owning
   modules, without implementation details.

Mini diagrams should link to their authoritative full diagram in nearby prose.

## 9. Documentation integration map

Update these documents with mini diagrams or links:

| Document | Diagram integration |
|---|---|
| `README.md` | README architecture mini diagram |
| `docs/architecture/architecture.md` | System context, container, dependencies, data model |
| ADR-0001 | Modular-monolith mini diagram |
| ADR-0002 | Repository/storage mini diagram |
| `docs/security/threat-model.md` | Security boundaries and moderation mini diagram |
| Functional requirements | Journey mini diagrams |
| Phase 2 plan | Exchange lifecycle mini diagram |
| Phase 3 plan | Review and moderation mini diagrams |
| Phase 4 plan | Privacy, retention, and jobs mini diagram |
| `docs/testing/test-strategy.md` | Diagram validation and workflow coverage links |

Do not paste full diagrams into every document. Link to the canonical source and
rendered SVG/PDF instead.

## 10. Tool installation plan

Tool installation is a later implementation step, not part of this planning
commit.

### Mermaid

Install the CLI as a pinned development dependency:

```bash
npm install --save-dev @mermaid-js/mermaid-cli
```

Use it for all Mermaid sources and Markdown preview validation.

### D2

Install the pinned D2 binary through the project-approved machine/package
manager. Record the exact version in
`docs/diagrams/tooling/diagram-tool-versions.json`.

Do not rely on an unversioned global binary in CI.

### PlantUML

Use the existing Java runtime with a pinned PlantUML JAR. Store the JAR outside
the repository or retrieve it through a documented setup script; do not commit
the binary. Record the version and checksum.

### SVG and PDF conversion

Prefer native SVG output from each renderer for crisp browser and GitHub
display. Generate PDF from the same canonical source in the same render
command. If a renderer's PDF output is inconsistent, use a pinned
SVG-to-PDF converter and document the command in
`docs/diagrams/tooling/README.md`; never hand-edit either output.

The professional-output acceptance bar is:

- Vector SVG with selectable text
- PDF with selectable text and no raster-only screenshots
- Consistent fonts, spacing, arrowheads, and color semantics
- Readable at normal document width and when printed
- Stable output from the pinned tool versions

## 11. Rendering workflow

Create one deterministic command:

```bash
npm run diagrams:render
```

It must:

1. Read `diagram-catalog.yml`.
2. Render every registered full and mini source.
3. Write normalized SVG files to `docs/diagrams/rendered/svg/`.
4. Write normalized PDF files to `docs/diagrams/rendered/pdf/`.
5. Fail on missing tools, invalid source, missing output, or stale catalog
   entries.
6. Avoid network access during rendering.

Create a separate validation command:

```bash
npm run diagrams:check
```

It must verify:

- Every source has SVG and PDF outputs.
- Every catalog entry points to existing files.
- Every full diagram has a supporting Markdown document.
- Tool names and versions are recorded.
- No placeholder markers remain.
- Approved module/state names are used.
- Referenced documentation paths exist.
- No generated output is empty.

## 12. AI-agent instructions

Add an AI-facing section to `docs/diagrams/README.md` with these rules:

1. Read `diagram-catalog.yml` before editing any diagram.
2. Read the authoritative architecture/requirements documents listed for that
   diagram.
3. Inspect the relevant implementation and tests before changing a workflow,
   state, module, or entity relationship.
4. Update the source diagram first; never edit SVG/PDF manually.
5. Keep the diagram's declared scope and omissions intact.
6. Update the catalog when paths, tools, scope, or embedded documents change.
7. Run `npm run diagrams:check` and `npm run diagrams:render`.
8. Report implementation/diagram discrepancies instead of hiding them.
9. Never invent a provider, service, actor, state, or database attribute.
10. Use a focused commit and describe which full and mini diagrams changed.

## 13. Implementation order

Implement in this order:

1. Add diagram conventions and AI instructions.
2. Add the diagram catalog schema and validator.
3. Install and pin Mermaid CLI, D2, PlantUML, and conversion tools as needed.
4. Create system context and container architecture diagrams.
5. Create module dependencies and conceptual data model diagrams.
6. Create exchange lifecycle and moderation workflow diagrams.
7. Create review lifecycle and authorization boundaries diagrams.
8. Create privacy/retention and deployment diagrams.
9. Create and render all mini diagrams.
10. Embed mini diagrams and links in the documentation map.
11. Render all SVG/PDF outputs.
12. Run documentation consistency checks and review every rendered diagram.

## 14. Suggested commits

Keep commits focused:

1. `docs(architecture): define diagram conventions and catalog`
2. `chore(docs): add diagram rendering and validation tooling`
3. `docs(architecture): add context and container diagrams`
4. `docs(architecture): add dependencies and data model diagrams`
5. `docs(architecture): add exchange and moderation diagrams`
6. `docs(architecture): add review and authorization diagrams`
7. `docs(architecture): add privacy and deployment diagrams`
8. `docs(architecture): add embedded mini diagrams`
9. `docs(architecture): render svg and pdf diagram outputs`

Do not mix diagram work with unrelated U3 code, database migrations, or existing
working-tree changes.

## 15. Completion criteria

The work is complete when:

- `docs/diagrams/` contains all canonical sources, SVGs, and PDFs.
- The catalog describes every source and output.
- Full diagrams cover context, containers, dependencies, data, exchange,
  moderation, reviews, authorization, privacy, and deployment.
- Mini diagrams are embedded in the designated documents.
- Mermaid, D2, and PlantUML usage is intentional and documented.
- Rendering is reproducible from a clean checkout with recorded tool versions.
- Validation catches missing, stale, or unregistered diagram files.
- No diagram attempts to list every database attribute.
- The diagrams match the approved architecture and current implementation.
- AI agents can discover, update, validate, and render the diagram set by
  following `docs/diagrams/README.md` and `diagram-catalog.yml`.

## 16. Open decisions for implementation

These are intentionally deferred until implementation:

- Whether all rendered outputs belong in the repository or are generated in CI
  and attached to releases.
- The exact D2 and PlantUML versions.
- The exact SVG-to-PDF converter if native PDF output is insufficient.
- Whether the conceptual data model is more readable in PlantUML ER notation
  or Mermaid ER notation after a prototype.
- Whether any single full diagram must be split into two views for readability.
