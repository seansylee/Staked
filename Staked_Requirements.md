# Staked - Product Requirements Document (V2)

## Vision

Staked helps people follow through on commitments by putting real money behind their intentions.

The product is not a habit tracker.
The product is a commitment contract.

---

# Core Philosophy

People do not fail because they lack goals.

People fail because goals have no consequences.

Staked introduces financial accountability while framing the experience around protecting money rather than losing it.

---

# Vault Protection Model

## Overview

Users deposit funds into a vault when creating a challenge.

Funds remain locked for the duration of the challenge.

As commitments are completed, funds become protected.

Missed commitments reduce the amount of money protected.

At challenge completion, the protected amount is returned.

---

## Example

Stake: $300

Duration: 90 Days

Daily Protection Value:
$3.33

If the user completes all required commitments:

Protected Funds:
$300

Returned:
$300

If the user misses commitments equivalent to 10 days:

Protected Funds:
$266.70

Forfeited:
$33.30

Returned:
$266.70

---

# Challenge Creation

Users define:

- Challenge Name
- Stake Amount
- Challenge Duration
- One or More Goals

Example:

Challenge:
Summer Fitness

Stake:
$300

Duration:
90 Days

Goals:
- Gym 3x/week
- Run 2x/week

---

# Stake Amount

User-selected.

Minimum:
$50

Maximum:
$2,500

Platform Fee:
$3

Collected at challenge creation.

---

# Goals

Each goal contains:

- Name
- Target Count
- Time Window

Supported Windows:

- Daily
- Weekly
- Monthly

Examples:

- Gym 3x/week
- Commit code 1x/day
- Read 10 pages/day
- Pray 1x/day
- Run 10x/month

---

# Progress Tracking

MVP uses manual check-ins.

Users log completions.

Examples:

Gym:
+1

Read:
+1

Code Commit:
+1

Progress updates immediately.

---

# Dashboard

Displays:

## Stake Summary

Original Stake

Protected Funds

Funds At Risk

Challenge Progress

---

## Goal Progress

Gym:
2 / 3 This Week

Read:
5 / 7 This Week

Commit Code:
1 / 1 Today

---

# Notifications

Examples:

"1 gym session remaining this week."

"$12.48 is currently at risk."

"Protect your stake today."

---

# Challenge Completion

System calculates:

- Original Stake
- Protected Funds
- Forfeited Funds
- Amount Returned

Users receive remaining protected funds.

---

# Future Features

- GitHub Verification
- Apple Health Integration
- Strava Integration
- Oura Integration
- Accountability Partners
- Community Challenges
- Shared Stake Pools

---

# MVP Tech Stack

Frontend:
SwiftUI

Backend:
Supabase

Auth:
Supabase Auth

Payments:
Stripe

Analytics:
PostHog

Notifications:
APNs

---

# MVP Success Criteria

Users can:

- Create challenges
- Deposit funds
- Create goals
- Log progress
- Track protected funds
- Complete challenges
- Receive remaining funds

No AI.
No social features.
No automatic verification.

Primary objective:

Validate whether users are willing to stake real money to improve follow-through.
