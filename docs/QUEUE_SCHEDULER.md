# Queue & Scheduler hardening — v0.4.0

## What changed

The runtime now uses persisted IndexedDB stores for:

- jobs
- review candidates
- durable resource locks
- schedules
- runtime events

Database version: 3.

## Durable queue leases

A worker claims due jobs with a lease:

- `leaseOwner`
- `leaseExpiresAt`

If the service worker stops unexpectedly, a stale `PROCESSING` job becomes claimable again after its lease expires.

## Resource locks

Jobs also acquire a resource lock before touching the Facebook browser context.

Current key:

```text
facebook:active-tab
```

The same durable lock is used while an approved comment is being prepared in the Facebook composer, so scheduled scans cannot collide with a review action.

## Retry policy

Failed queue jobs use capped exponential backoff:

```text
1st failure: 1 minute
2nd failure: 2 minutes
3rd failure: 4 minutes
...
maximum: 30 minutes
```

A job has a configurable retry ceiling. Scheduled review scans currently use four attempts.

## Scheduler

The scheduler persists review-scan schedules locally.

Each schedule supports:

- name
- enabled / paused
- interval from 15 minutes to 24 hours
- maximum posts per run
- local start hour
- local end hour
- next run
- last run

A scheduled run only performs:

```text
scan visible Facebook posts
→ generate AI drafts
→ save candidates as READY_FOR_REVIEW
```

It does not approve or submit anything.

## Facebook tab selection

The runtime now searches for an open Facebook tab instead of assuming the dashboard tab is the active browser tab. It prefers:

1. active Facebook tab in the current window
2. another Facebook tab in the current window
3. any open Facebook tab

This allows the scheduler and dashboard to coexist reliably.

## Runtime event log

Real runtime events are stored for:

- SYSTEM
- QUEUE
- SCHEDULER
- REVIEW

Levels:

- INFO
- WARN
- ERROR

The dashboard **Nhật ký runtime** page now reads these persisted events instead of demo rows.

## Safety

The scheduler is intentionally limited to review-candidate generation.

It does not:

- auto-approve AI output
- auto-submit comments
- bypass Emergency Stop
- ignore session limits
- run concurrent browser actions against the same locked resource

Final social-platform submission remains manual.
