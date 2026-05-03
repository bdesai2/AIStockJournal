# M5 Cross-Device and Lighthouse Validation Checklist

Last updated: 2026-05-03

## Scope

Use this checklist to validate M5 mobile polish, PWA behavior, and performance quality across representative devices and browsers.

## Device Matrix

- [ ] iPhone 13 / Safari
- [ ] iPhone SE / Safari
- [ ] Pixel 7 / Chrome
- [ ] Samsung mid-tier Android / Chrome
- [ ] iPad / Safari
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Edge

## Core Functional Flows

- [ ] Login and redirect to dashboard
- [ ] Create trade form completion on mobile keyboard
- [ ] Edit trade and save
- [ ] Journal day selection and note save
- [ ] Settings profile update and save
- [ ] Account modal open/edit/close on mobile full-screen layout
- [ ] CSV export from trades list
- [ ] Batch trade export with selection mode
- [ ] Dashboard monthly report export
- [ ] Dashboard quarterly report export
- [ ] Journal monthly report export

## Mobile UX Validation

- [ ] No clipped fields on New Trade page in portrait orientation
- [ ] Number fields bring numeric/decimal keyboard where expected
- [ ] Text fields use sensible auto-capitalization behavior
- [ ] Sticky submit area remains accessible above mobile nav
- [ ] Tap targets are comfortable (no accidental adjacent taps)
- [ ] Modal interactions do not trap background scroll unexpectedly

## PWA and Offline Validation

- [ ] Install prompt works on supported browsers
- [ ] Service worker registration succeeds in production build
- [ ] Offline banner appears when network is disabled
- [ ] Offline queue increments for write operations while offline
- [ ] Sync retries when connection is restored
- [ ] Realtime status indicator updates appropriately

## Performance Checks

- [ ] Initial route load: dashboard chunk loads successfully
- [ ] Route transition load for trades page is smooth
- [ ] Image uploads are optimized (reduced file size where possible)
- [ ] No obvious long main-thread stalls during chart rendering

## Lighthouse Targets (Mobile)

Run Lighthouse in Chrome (mobile emulation, throttling enabled) on key routes:

- /dashboard
- /trades
- /journal

Targets:

- [ ] Performance >= 85
- [ ] Accessibility >= 90
- [ ] Best Practices >= 90
- [ ] SEO >= 85

## Accessibility and Resilience

- [ ] Keyboard navigation works for major actions
- [ ] Form validation errors remain visible and readable
- [ ] Offline and error states are understandable
- [ ] Export buttons are discoverable and labeled

## Sign-off

- [ ] QA completed by: __________________
- [ ] Date: __________________
- [ ] Notes / Issues: __________________
