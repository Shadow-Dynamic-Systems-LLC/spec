# Pattern: Authentication Gate

**ID:** `auth_gate`  
**Version:** 1.0.0  
**Status:** active  
**Domain tags:** security, auth, access-control

---

## Intent

Enforce identity verification before any capability or resource access. Ensure credentials are validated, tokens are scoped, and all authentication events are logged regardless of outcome.

## Capability Composition

```yaml
requires_before:
  - audit_log         # Record authentication attempt before any access
requires_after:
  - audit_log         # Record authentication outcome (success or failure)
```

Conditionally add `scope_boundary` to verify the authenticated identity is authorized for the requested resource domain.

## Authentication Decision Tree

```
Access Request
  └── credential_present?
        ├── NO  → reject (401) + log
        └── YES → credential_valid?
                    ├── NO  → reject (401) + log + increment_failure_count
                    └── YES → token_scoped_to_resource?
                                ├── NO  → reject (403) + log
                                └── YES → grant + issue_session_token + log
```

## When to Use

- Any capability boundary where caller identity must be established
- API endpoints, tool invocations, and inter-agent calls where trust is not assumed
- Systems requiring non-repudiation (authenticated identity tied to `audit_log_entry`)

## When NOT to Use

- Internal function calls within a single trust boundary
- Actions already operating under a verified session token with sufficient scope

## Key Variables

| Variable | Description | Default |
|---|---|---|
| `identity_provider` | Auth backend (JWT, OAuth2, mTLS, API key) | — |
| `token_expiry_seconds` | Session token lifetime | `3600` |
| `max_failure_count` | Failed attempts before lockout | `5` |
| `lockout_duration_seconds` | Lockout window after max failures | `300` |
| `required_scopes` | Token scopes required for the requested action | — |

## Evidence Produced

- `audit_log_entry` — on every authentication attempt (success and failure)
- `session_token` — on successful authentication, cryptographically bound to identity + scopes
- `lockout_record` — when failure threshold is exceeded

## Compose With

- `scope_boundary` — pair after successful authentication to verify authorization
- `human_approval_gate` — for privileged access requiring additional approval beyond authentication
- `audit_log` — required before and after (see composition above)

## Conflicts With

- `auto_execute` — cannot bypass authentication on the same action path

## Reusable Parts

- `requirement-snippets:authenticated-identity-required`
- `scenario-snippets:auth-gate-happy-path`
- `scenario-snippets:auth-gate-invalid-credentials`
- `scenario-snippets:auth-gate-expired-token`
- `control-snippets:no-access-without-valid-token`
- `evidence-snippets:session-token-post-auth`
