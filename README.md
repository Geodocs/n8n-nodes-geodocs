# n8n-nodes-geodocs.io

[n8n](https://n8n.io/) Official node for [Geodocs](https://geodocs.io/) — GIS project management platform.

This package provides two nodes:

- **Geodocs Trigger** — starts a workflow when Geodocs events occur (folder, assignment, expense, budget lifecycle events)
- **Geodocs Fetch** — search and lookup folders, assignments, expenses, and budgets

## Installation

In your n8n instance, go to **Settings > Community Nodes > Install** and enter:

```
n8n-nodes-geodocs.io
```

## Credentials

You need a Geodocs Personal Access Token (PAT) to use these nodes. More info at [Geodocs Integrations](https://geodocs.io/integrations).

1. In Geodocs, go to **Settings > API Tokens**
2. Create a new token with the required scopes (see below)
3. In n8n, create a new **Geodocs API** credential with your API URL and token

## Required PAT Scopes

| Node            | Required Scope                                                                             |
| --------------- | ------------------------------------------------------------------------------------------ |
| Geodocs Trigger | `webhooks:manage`                                                                          |
| Geodocs Fetch   | `folders:read`, `assignments:read`, `expenses:read`, or `budgets:read` (matching resource) |

## Trigger Events

| Event                | Description        |
| -------------------- | ------------------ |
| `folder.created`     | Folder created     |
| `folder.updated`     | Folder updated     |
| `folder.deleted`     | Folder deleted     |
| `folder.archived`    | Folder archived    |
| `assignment.created` | Assignment created |
| `assignment.updated` | Assignment updated |
| `assignment.deleted` | Assignment deleted |
| `expense.created`    | Expense created    |
| `expense.updated`    | Expense updated    |
| `expense.deleted`    | Expense deleted    |
| `budget.created`     | Budget created     |
| `budget.updated`     | Budget updated     |
| `budget.deleted`     | Budget deleted     |

## Webhook Signature Verification

The trigger node automatically verifies the `X-Geodocs-Signature` header using HMAC-SHA256 with `timingSafeEqual`. Invalid signatures are rejected.

## Development

```bash
npm install
npm run build
```

## License

MIT
