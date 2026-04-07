# Architecture: {{CHANGE_NAME}}

<!-- library_source: architecture.template -->
<!-- tier: {{TIER}} -->
<!-- created: {{DATE}} -->

## System Boundaries

<!-- What is in scope for this change? What is external? -->
{{SYSTEM_BOUNDARIES}}

## Component Interfaces

<!-- APIs, contracts, and data flows between components. -->
{{COMPONENT_INTERFACES}}

## Dependency Graph

<!-- External systems and services. Mark each: internal | external | third-party -->
{{DEPENDENCY_GRAPH}}

## Trust Zones

<!-- Where do trust boundaries exist? Which zone does each component operate in? -->
{{TRUST_ZONES}}

## Control Points

<!-- Where does policy enforcement occur? Reference capability IDs from registry.yaml. -->
{{CONTROL_POINTS}}

## Architecture Decisions

<decision id="ADR-001" requirements="REQ-001">
<!-- Decision: We chose X over Y.
Rationale: ...
Alternatives considered: Y (rejected because ...), Z (rejected because ...)
Consequences: ... -->
{{DECISION_BODY}}
</decision>
