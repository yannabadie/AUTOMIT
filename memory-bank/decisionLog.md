# Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-23 | ZeroClaw over OpenClaw | ZeroClaw is a single Rust binary (3.4MB), supports Codex OAuth, embeds SQLite memory. OpenClaw is Python-based, heavier, and less suited for constrained Docker environments. |
| 2026-02-23 | Kestra over Temporal/Airflow | Kestra has native YAML flows, Docker-isolated execution, webhook triggers, Pause for human approval, and a built-in UI. No JVM/Python runtime needed for flow definitions. |
| 2026-02-24 | Codex OAuth via nginx sidecar | ZeroClaw uses rustls+webpki-roots which rejects corporate MITM certificates (UnknownIssuer). Solution: nginx sidecar proxy with corporate CA in system store. ZeroClaw calls http://openai-proxy then nginx terminates TLS to chatgpt.com. |
| 2026-02-24 | MCP-only for ERP access | Direct SQL from Docker to CEGID (port 1433) is blocked by corporate firewall. MCP cegid-oracle (10.255.15.200:8000) provides read-only access via JSON-RPC. Same pattern for Sage X3 via x3-oracle. |
| 2026-02-25 | Kestra Pause for 4-eyes | EN9100 compliance requires segregation of duties. Kestra Pause task blocks flow execution until human validates via UI. Used for all L2 operations (onboarding, offboarding, remediation). |
| 2026-02-25 | Graph API Mail.Send + Application Access Policy | Mail.Send permission allows sending as any user. Restricted to a dedicated shared mailbox (automit-noreply) via Exchange Online Application Access Policy. No license needed for shared mailbox. |
| 2026-02-25 | Entra ID rename (Azure AD) | Microsoft renamed Azure AD to Entra ID in 2023. Endpoints unchanged (login.microsoftonline.com, graph.microsoft.com). Updated all references in codebase. |
