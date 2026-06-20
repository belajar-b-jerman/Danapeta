# Planner Keuangan Future Sync API

## Purpose
Future sync is optional. The local app must remain fully useful without an account, network, or remote backend.

## Sync Principles
- User opt-in only.
- Encrypt sensitive payloads before upload where practical.
- Never delete local data because of subscription or network failure.
- Sync metadata lives beside local entities from day one.
- Conflicts are explicit and recoverable.

## Local Sync Metadata

```ts
type SyncMeta = {
  syncStatus: "local" | "pending" | "synced" | "conflict";
  remoteId?: string;
  version: number;
  updatedAt: string;
  deletedAt?: string;
};
```

## API Shape

### Push Changes
`POST /v1/sync/push`

Request:

```json
{
  "deviceId": "device_123",
  "workspaceId": "workspace_123",
  "changes": [
    {
      "entity": "transactions",
      "localId": "txn_123",
      "remoteId": null,
      "version": 1,
      "operation": "upsert",
      "payload": {}
    }
  ]
}
```

Response:

```json
{
  "accepted": [
    {
      "localId": "txn_123",
      "remoteId": "remote_txn_123",
      "version": 2
    }
  ],
  "conflicts": []
}
```

### Pull Changes
`GET /v1/sync/pull?workspaceId=...&cursor=...`

Response:

```json
{
  "cursor": "cursor_456",
  "changes": [
    {
      "entity": "budgets",
      "remoteId": "remote_budget_123",
      "version": 3,
      "operation": "upsert",
      "payload": {}
    }
  ]
}
```

## Conflict Strategy
- Use last-write-wins only for low-risk settings.
- Transactions, budgets, and goals should enter `conflict` state when two devices edit the same version.
- Conflict UI shows local version, remote version, and merge options.
- Deletions are soft deletes with `deletedAt`.

## Security
- Use short-lived access tokens.
- Use refresh tokens only in secure browser storage patterns appropriate for PWA constraints.
- Support device revocation.
- Keep encryption keys out of server-readable payloads when end-to-end encryption is enabled.

## Backend-Agnostic Design
The client should depend on a `SyncAdapter` interface so the first backend can be replaced later.

```ts
type SyncAdapter = {
  push(changes: LocalChange[]): Promise<PushResult>;
  pull(cursor?: string): Promise<PullResult>;
};
```

