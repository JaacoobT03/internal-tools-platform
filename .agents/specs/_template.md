# Spec: <app name>

> Copy this file to `.agents/specs/<app-name>.md` and fill in every section. Write "None" rather than deleting a section.

## Customer experience

<!-- Who uses this app and what they are trying to achieve. Describe the main screens and flows from the user's point of view. -->

## Required behavior

<!-- Numbered, testable statements of what the app must do, including edge cases and error responses. Each item should map to at least one test. -->

1.

## Roles and permissions

<!-- Which roles (viewer, requester, approver, auditor) can do what. List every permission as `<app>.<resource>.<action>` and the endpoints that require it. List any endpoint that must be @Public() and why. -->

| Permission | Granted to roles | Endpoints |
| ---------- | ---------------- | --------- |
|            |                  |           |

## Personal data fields

<!-- Every field containing personal data (email, card number, ...), how it is masked by default, and which permission allows reveal. Write "None" if the app holds no personal data. -->

| Field | Masked format | Reveal permission |
| ----- | ------------- | ----------------- |
|       |               |                   |

## Approval rules

<!-- Actions requiring a second approver, their thresholds (amounts as integer cents + currency), and what happens while pending. Write "None" if the app has no approvals. -->

| Action | Threshold | Approver role | Effect while pending |
| ------ | --------- | ------------- | -------------------- |
|        |           | approver      | none                 |
