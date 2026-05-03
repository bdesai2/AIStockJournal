# M6 Production Readiness Sign-Off Process

## Purpose

This checklist captures ownership and approval flow for production privacy and security readiness before release.

## Scope

- Security headers and HTTPS/HSTS verification at hosting layer
- Privacy operation rate limits (server-side)
- Right-to-erasure execution path (application data + auth-layer account deletion)
- Compliance/legal policy review of privacy and terms pages

## Required Reviewers

- Engineering Owner: Platform Lead
- Security Reviewer: Security Lead
- Compliance/Legal Reviewer: Compliance Owner
- Release Approver: Product Owner

## Approval Workflow

1. Engineering owner verifies implementation and evidence links.
2. Security reviewer validates checklist and threat/risk controls.
3. Compliance/legal reviewer confirms policy and disclosure alignment.
4. Product owner grants final go/no-go approval.

## Evidence to Attach

- Header verification output (for deployed domain)
- API route tests for privacy export/delete rate limits
- Deletion test evidence confirming auth user deletion
- Updated `SECURITY_CHECKLIST.md` sign-off section

## Ownership and Dates

- Process owner assigned: Platform Lead
- Security checklist owner assigned: Security Lead
- Compliance process owner assigned: Compliance Owner
- Ownership assigned date: 2026-05-03
- Target final approval date: 2026-05-10
