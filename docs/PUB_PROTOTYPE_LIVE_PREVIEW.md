# PUB Prototype — Live Preview Contract

The Prototype Mode UI is a persistent split workspace: chat on the left, live application preview on the right.

## Event flow

`USER_PROMPT` → `AGENT_STARTED` → agent/build events → `CHECKPOINT_CREATED` → `PREVIEW_READY` or failure event.

## Browser transport

`GET /prototype/sessions/:id/events` uses Server-Sent Events (SSE).

Worker and API are separate processes. Prototype events are persisted in PostgreSQL and broadcast with `NOTIFY`/`LISTEN`; the API fans them out to session-scoped SSE clients.

The current endpoint sends:

- a connection comment immediately;
- JSON `PrototypeEvent` records as `data:` frames;
- a heartbeat comment every 15 seconds.

The event table is also the basis for future reconnect/replay support.

## Preview runtime boundary

The browser never supplies a filesystem path or arbitrary process command. The worker/runtime layer owns those values.

## Preview modes

`PROTOTYPE_PREVIEW_MODE=public` uses a Cloudflare Quick Tunnel and returns a public HTTPS preview URL. `local` keeps the runtime on localhost.

Public preview URLs are for MVP validation and demos, not production traffic or sensitive data.

## Provider

Prototype Mode uses the configured `AGENT_PROVIDER`; `9router` is the recommended production path because it preserves provider/model independence. The normal PDL Development path remains separate from Prototype Mode.