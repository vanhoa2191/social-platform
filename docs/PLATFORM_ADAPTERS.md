# Platform adapters & account context — v0.5.0

## Goal

Move Facebook DOM knowledge out of the generic extension runtime and bind automation work to an explicit browser account context.

The browser runtime still does not auto-submit social interactions. It only scans content, creates review candidates, and can prepare text that the user explicitly approved.

## Adapter architecture

```text
content script
   |
   v
platform registry
   |
   +-- facebook-web-v1
          |
          +-- surface detection
          +-- account context detection
          +-- feed/article reading
          +-- composer discovery
          +-- diagnostics
```

Files:

- `src/platform/types.ts`
- `src/platform/registry.ts`
- `src/platform/facebook/helpers.ts`
- `src/platform/facebook/selectors.ts`
- `src/platform/facebook/adapter.ts`

## Facebook surfaces

The adapter classifies the current page as:

- `FEED`
- `GROUP`
- `PAGE`
- `POST`
- `UNKNOWN`

The current read adapter can scan visible article nodes on Feed, Group, Page and Post surfaces. It does not claim support for every Facebook UI variant.

## Account context

The adapter looks only at profile evidence in Facebook navigation/header areas rather than arbitrary author links in the feed.

A context contains:

```ts
{
  platform: 'facebook'
  key: 'facebook:<fingerprint>'
  label: string
  profileUrl?: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  verified: boolean
  evidence: string[]
}
```

“Verified” here means the extension found sufficiently strong DOM/URL evidence that the browser context is internally consistent. It is not identity verification by Facebook.

## Context binding

When a schedule is saved:

1. the background worker finds an open Facebook tab;
2. the content adapter reads its account context;
3. the context must be verified;
4. the schedule stores the context key and label.

When a scheduled job runs:

1. the worker searches all open Facebook tabs;
2. it selects only a tab with the expected context key;
3. the queue lock key is scoped to that account;
4. the scan creates candidates carrying the same context key.

When an approved candidate is prepared:

1. the candidate must contain an account context key;
2. the runtime locates the matching verified Facebook tab;
3. a per-account browser lock is acquired;
4. the approved text is inserted;
5. the user still manually submits.

This prevents a candidate captured under one account context from being prepared under another detected account context.

## Adapter diagnostics

The diagnostic endpoint returns:

- adapter id
- health: `HEALTHY | DEGRADED | UNAVAILABLE`
- surface
- number of article nodes
- composer count
- account-evidence count
- warnings

The **Tài khoản & Profile** screen now shows live context and adapter diagnostics rather than a fake account table.

## Selector maintenance

Facebook selectors are centralized in:

```text
src/platform/facebook/selectors.ts
```

When Facebook changes DOM structure, selectors and adapter logic can be updated without changing queue, scheduler, AI or review state-machine code.

## Known limitations

- Facebook DOM can change without notice.
- Some localized or experimental Facebook layouts may not expose enough account evidence.
- Existing schedules created before v0.5.0 are unbound and will not run until edited and saved again.
- A tab may need to be refreshed after installing/updating the unpacked extension so the content script is present.
- Final submission remains manual.
