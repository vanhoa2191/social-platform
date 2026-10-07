# Audit fixes — v0.11.0-beta

This release addresses all P0/P1 findings from the comprehensive audit.

## P0 — review integrity

- Existing review candidates are never regenerated automatically by a later scan.
- Approval stores a separate immutable approved-draft snapshot.
- Composer preparation reads only the approved snapshot.
- Legacy approved candidates without a snapshot are blocked and must be reviewed again.
- Retry/regenerate clears stale approval snapshots.

## P1 — queue and locking

- Queue jobs and resource locks now have a 30-second heartbeat while processing.
- Long AI generation batches no longer become stale after the initial two-minute lease.

## P1 — schedule sync

- Schedule definition revisions are separated from runtime execution timestamps.
- Running a schedule does not create a new cloud definition revision.
- Remote-only schedules are pulled automatically.
- Local-only/newer local schedules are pushed.
- Newer remote schedules remain explicit conflicts.
- Equal revisions with different definitions are also explicit conflicts.

## P1 — telemetry backlog

- Runtime DB v5 adds a compound createdAt/id event index.
- Telemetry uses a tuple watermark and ascending cursor pagination.
- More than 500 offline events are drained across sync calls without skipping older backlog.

## P1 — AI gateway

- Real AI providers require gateway authentication.
- Per-isolate request rate limiting is enabled.
- Request body size is capped.
- Provider calls have a server-side timeout.
- Model output length is capped.
- OpenAI-compatible and Gemini output token limits are explicit.
- Extension sends only post id/text/author to the gateway; source URLs stay local.

## P1 — product/UI truthfulness

- Campaign UI no longer exposes unsupported like/share/reaction/group/page/autopost actions as runnable features.
- The beta workflow creator now persists a real schedule for the supported Feed → AI draft → review → prepare flow.
- Mock KPI analytics were removed from the production-facing dashboard.
