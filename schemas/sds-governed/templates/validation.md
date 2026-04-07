## Pre-Approval Checks

<!-- Required before this governed-tier change is approved. -->
<!-- Each item must reference a control ID and specify the required evidence form. -->

<evidence id="EVD-001" control="CTL-001" form="approval_token" gate="pre-approval">
- [ ] <!-- Verification step description -->
</evidence>

## Pre-Merge Checks

<!-- Required before the change branch is merged to main. -->

<evidence id="EVD-002" control="CTL-001" form="test_output" gate="pre-merge">
- [ ] <!-- Verification step description -->
</evidence>

## Pre-Release Checks

<!-- Required before deployment to a Lighthouse execution envelope. -->
<!-- Must include: /sds:check-drift passes, /sds:simulate-capability shows no open CRITICAL findings. -->

<evidence id="EVD-003" control="CTL-001" form="hash" gate="pre-release">
- [ ] Run `/sds:check-drift` — must pass with no violations
- [ ] Verify `simulation.md` contains no open CRITICAL findings
- [ ] <!-- Additional pre-release verification -->
</evidence>
