# Implementation Audit and Checklist

Scope: the Arena marketplace (Next.js 16 App Router, Drizzle/PostgreSQL, REST API under `/api`).
Method: static review of every page, component and API route, plus an end-to-end API run against a production build (`scripts/journey-smoke.mjs`).

Legend: **DONE** = implemented and verified · **PARTIAL** = works with a known gap · **OPEN** = not implemented.

## P0: Customer journey (Homepage → Search → Service → Booking → Location → Appointment → Offers → Selection → Confirmation → Dashboard)

| # | Finding | Status |
|---|---------|--------|
| 1 | Booking submit did not change the URL; refresh returned the empty form and the order confirmation was not addressable. | DONE: `/booking/order/[id]` |
| 2 | Server field errors on booking were swallowed by `useAction().run`, so the form never showed them. | DONE: `runStrict` returns errors to the caller |
| 3 | Time slots showed raw ids (`08 تا 10`) and allowed slots already in the past today. | DONE: Persian labels, past slots disabled (Tehran time) |
| 4 | Header city selector did not affect booking; new addresses defaulted to Tehran. | DONE: booking uses the selected city |
| 5 | Only one demo offer was produced for "نشتی لوله" (only one pro in the leaf category). | DONE: fallback to sibling categories, up to three offers |
| 6 | Order confirmation had no invoice / printable summary. | DONE: `/account/orders/[id]/invoice` |
| 7 | Professional selection had no confirmation on the booking page. | DONE: confirm dialog |
| 8 | Customers could not edit a review within the 7-day window (API existed, no UI). | DONE: edit in order detail |
| 9 | Professionals could not be saved as favourites (only services). | DONE: save button on pro cards + shared favourites context |
| 10 | Appointment reminders were never generated. | DONE: generated when notifications are loaded (within 24h of a confirmed order) |

## P0: Data integrity (defects found during audit)

| # | Finding | Status |
|---|---------|--------|
| 11 | Admin service edit reset `benefits`, `steps`, `requirements`, `priceFactors`, SEO fields and `isActive` on every save (data loss). | DONE: forms load and resend the full record |
| 12 | Admin category edit reset SEO fields and sort order. | DONE |
| 13 | Banners / FAQs had no active toggle; saving re-activated them. Blog publish state was inferred from a string. | DONE: explicit toggles and fields |
| 14 | Services and categories had no admin control for SEO metadata. | DONE |

## P1: Missing features

| # | Feature | Status |
|---|---------|--------|
| 15 | Public blog list and article pages (`/blog`, `/blog/[slug]`). Managed in admin but never rendered. | DONE |
| 16 | Public static pages (`/pages/[slug]`, e.g. about and terms). Managed in admin but never rendered. | DONE |
| 17 | Footer did not link to content pages. | DONE |
| 18 | `sitemap.xml` and `robots.txt`. | DONE |
| 19 | Open Graph tags on service pages. | DONE |
| 20 | Newsletter / promotional subscription (only static CTAs existed). | DONE: stored in `newsletter_subscribers` |
| 21 | Professional portfolio editing (data existed, no editor). | DONE |
| 22 | Professional profile photo. | DONE |
| 23 | Professional document upload (names were stored, no files; admin could not review). | DONE: image uploads, previewed in admin |
| 24 | Professional notifications page (sidebar had none). | DONE |
| 25 | Professional view of their own offers and outcomes. | DONE |
| 26 | Admin order detail (timeline, offers, payments). | DONE |
| 27 | Admin user detail with editable name and email. | DONE |
| 28 | Admin professional list showed no rating or review count. | DONE |
| 29 | Admin can edit a service's `isActive` (availability). | DONE |

## P2: Known gaps (not implemented, not claimed)

| # | Gap | Notes |
|---|-----|-------|
| 30 | Phone-number change in the customer profile. | OPEN: phone is read-only; changing it needs OTP to the new number. |
| 31 | Email verification. | OPEN: only phone verification exists. |
| 32 | Map-based location selection. | OPEN: city, region and free-text address only. |
| 33 | Rate limiting for login and OTP. | OPEN: needed before production. |
| 34 | Session expiry on dashboards redirects nothing; the user sees a toast only. | OPEN |
| 35 | Modals and drawers trap focus only on open, not on Tab. | OPEN: accessibility gap. |
| 36 | Admin cannot re-assign a professional's categories. | OPEN |
| 37 | Admin manual refund for disputes. | OPEN: refunds happen on cancellation only. |
| 38 | Visual builder for service questions. | PARTIAL: JSON editor with a field-type reference. |
| 39 | Real payment gateway. | OPEN: sandbox provider behind an interface. |
| 40 | Invoices are HTML printable pages, not generated PDFs. | PARTIAL |
| 41 | Unread badges for messages and notifications in the dashboard navigation. | OPEN |

## Verification

- `scripts/journey-smoke.mjs` runs the customer journey against a running production server: registration, search, booking validation, order creation, demo offers, a new professional applying and being approved by admin, a real professional offer, selection, sandbox payment, confirmation and invoice pages, dashboard pages, newsletter, blog and static pages, sitemap and robots, professional and admin pages and APIs, role guards, and admin service edits that keep existing content.
- Latest run: **63 of 63 checks passed** on a fresh production build.

## Known data limits (not code defects)

- The seeded plumbing category has one verified professional, so demo offers for "نشتی لوله" are one or two. The smoke test adds a real approved professional to show the full offer path. A fresh database gets the same seed.
- Offers from demo professionals are labelled as demo offers in the UI.
