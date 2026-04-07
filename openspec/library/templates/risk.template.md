# Risk: {{CHANGE_NAME}}

<!-- library_source: risk.template -->
<!-- tier: {{TIER}} -->
<!-- created: {{DATE}} -->

## Failure Modes

<risk id="RSK-001" severity="{{SEVERITY}}" library_source="{{LIBRARY_SOURCE_IF_APPLICABLE}}">
<!-- trigger: What causes this risk to materialize?
mitigation: How is it prevented or contained?
residual: What risk remains after mitigation?
rollback: What rollback conditions exist? -->
{{RISK_BODY}}
</risk>

## Misuse Paths

<!-- Adversarial or edge-case inputs that could cause unsafe behavior.
Format: - **<Input/Path>**: <unsafe outcome> → <prevention> -->
{{MISUSE_PATHS}}

## Rollback Assumptions

<!-- What assumptions must hold for rollback to succeed?
What conditions trigger automatic rollback?
What is the blast radius of a failed rollback? -->
{{ROLLBACK_ASSUMPTIONS}}

## Residual Risk Acceptance

<!-- After all mitigations: what residual risk is explicitly accepted?
Each accepted residual risk must have an identified owner. -->
{{RESIDUAL_RISK}}
