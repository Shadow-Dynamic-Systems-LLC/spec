# PRD: {{CHANGE_NAME}}

<!-- library_source: prd.template -->
<!-- tier: {{TIER}} -->
<!-- created: {{DATE}} -->

## User Outcomes

<!-- What outcomes does this change enable? Frame from the user's perspective. -->
{{USER_OUTCOMES}}

## Functional Requirements

<requirement id="REQ-001" library_source="{{LIBRARY_SOURCE_IF_APPLICABLE}}">
<!-- The system SHALL ... -->
{{REQUIREMENT_BODY}}
</requirement>

<scenario id="SCN-001" requirement="REQ-001">
<!-- WHEN ...
THEN ... -->
{{SCENARIO_BODY}}
</scenario>

## Non-Functional Requirements

<requirement id="REQ-NFR-001">
<!-- The system SHALL ... (performance, reliability, security) -->
{{NFR_BODY}}
</requirement>

## Constraints

<!-- Technical or organizational constraints. -->
{{CONSTRAINTS}}

## Scope Boundaries

- OUT OF SCOPE: {{OUT_OF_SCOPE}}

## Success Metrics

<!-- Measurable criteria for evaluating success. -->
{{SUCCESS_METRICS}}
