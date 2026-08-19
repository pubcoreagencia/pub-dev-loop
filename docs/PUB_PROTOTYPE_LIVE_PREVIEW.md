# PUB Prototype — Live Preview Contract

The Prototype Mode UI is a persistent split workspace: chat on the left, live application preview on the right.

## Event flow

`USER_PROMPT` → `AGENT_STARTED` → agent/build events → `CHECKPOINT_CREATED` → `PREVIEW_READY` or failure event.

## Browser transport

`GET /prototype/sessions/:id/events` uses Server-Sent Events (SSE).

The stream is session-scoped and sends:

- a connection comment immediately;
- JSON `PrototypeEvent` records as `data:` frames;
- a heartbeat comment every 15 seconds.

The current stream is process-local and intentionally lightweight. Later slices should persist/replay events from PostgreSQL or a durable broker so reconnecting clients can recover missed events.

## Preview runtime boundary

The browser never supplies a filesystem path or arbitrary process command. The worker/runtime layer owns those values. This boundary is required before exposing live preview controls externally.
