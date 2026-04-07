# Validation: {{CHANGE_NAME}}

<!-- library_source: validation.template -->
<!-- tier: {{TIER}} -->
<!-- created: {{DATE}} -->

## Pre-Approval Checks

<!-- Required before this governed-tier change is approved. -->

<evidence id="EVD-001" control="CTL-001" form="approval_token" gate="pre-approval"
           library_source="{{LIBRARY_SOURCE_IF_APPLICABLE}}">
- [ ] {{PRE_APPROVAL_CHECK}}
</evidence>

## Pre-Merge Checks

<!-- Required before the change branch is merged to main. -->

<evidence id="EVD-002" control="CTL-001" form="tool_output" gate="pre-merge">
- [ ] `/sds:traceability-check` passes with no errors
- [ ] {{PRE_MERGE_CHECK}}
</evidence>

## Pre-Release Checks

<!-- Required before deployment to a Lighthouse execution envelope. -->
<!-- Drift detection items require Phase 4 tooling — mark BLOCKED until available. -->

<evidence id="EVD-003" control="CTL-001" form="tool_output" gate="pre-release">
- [ ] `simulation.md` contains no open CRITICAL findings
- [ ] [BLOCKED until Phase 4] `/sds:check-drift` passes with no violations
- [ ] {{PRE_RELEASE_CHECK}}
</evidence>
