# CPM Pricing Model Documentation

This document provides a comprehensive breakdown of the CPM (Cost Per Mille) pricing model, including all variables, adjustment multipliers, and the final calculation formula.

---

## 1. Core Concepts

| Term | Definition | Default Value |
|------|------------|---------------|
| **CPM** | Cost Per Mille (1,000 impressions) | N/A |
| **Base CPM** | The starting price per 1,000 impressions before any adjustments | `$2.50` |
| **Traffic Tier** | A time-of-day classification that affects pricing | Medium (1.0x) |
| **Multiplier** | A factor applied to the Base CPM to adjust the final price | 1.0 (no change) |

---

## 2. Variables & Adjustments

### 2.1 Base CPM (Override Hierarchy)

The Base CPM is determined by checking for overrides in this priority order:

1.  **Screen-Level Override**: A specific price set for a single screen.
2.  **Store-Level Override**: A price set for all screens in a store.
3.  **Retailer-Level Override**: A price set for all screens belonging to a retailer.
4.  **Global Base CPM**: The system-wide default.

> **Example:** If the Global Base CPM is `$2.50`, but Costco (retailer) has an override of `$3.00`, all Costco screens use `$3.00`.

---

### 2.2 Traffic Tiers

Traffic Tiers adjust the price based on the time of day. Each tier has a `multiplier`.

| Tier | Multiplier | Color | Hours (24h) | Description |
|------|------------|-------|-------------|-------------|
| **Very Low** | `0.50x` | Gray | 8, 9, 20, 21 | Opening/closing hours |
| **Low** | `0.75x` | Blue | 10, 11, 19 | Morning/late afternoon |
| **Medium** | `1.00x` | Yellow | 14, 15, 16 | Standard afternoon |
| **High** | `1.50x` | Green | 12, 13, 17, 18 | Lunch & rush hour peaks |

---

### 2.3 Date Override Multiplier

A date-specific multiplier for holidays or special events.

| Event Type | Multiplier | Example |
|------------|------------|---------|
| Normal Day | `1.0x` | Any regular day |
| Holiday | `1.5x` | New Year's Eve |
| Major Event | `2.0x` | Super Bowl Sunday |
| Slow Day | `0.75x` | Quiet weekday |

---

### 2.4 Store Traffic Level Multiplier

An adjustment based on the foot traffic classification of a specific store.

| Store Traffic Level | Multiplier |
|---------------------|------------|
| High | `1.25x` |
| Medium | `1.00x` |
| Low | `0.80x` |

---

## 3. The Master Formula

The final slot price is calculated as:

```
Slot CPM = Base CPM × Traffic Tier Multiplier × Date Multiplier × Store Traffic Multiplier
```

---

## 4. Calculation Examples

### Example 1: Standard Weekday, Lunchtime, Normal Store

| Variable | Value | Source |
|----------|-------|--------|
| Base CPM | `$2.50` | Global Default |
| Traffic Tier | `High` (1.5x) | 12:00 PM is a peak hour |
| Date Multiplier | `1.0x` | Normal day |
| Store Traffic | `Medium` (1.0x) | Average foot traffic |

**Calculation:**
```
Slot CPM = $2.50 × 1.5 × 1.0 × 1.0 = $3.75
```

---

### Example 2: Holiday, Morning, Low-Traffic Store

| Variable | Value | Source |
|----------|-------|--------|
| Base CPM | `$2.50` | Global Default |
| Traffic Tier | `Very Low` (0.5x) | 9:00 AM is opening hour |
| Date Multiplier | `1.5x` | Holiday override |
| Store Traffic | `Low` (0.8x) | Low foot traffic store |

**Calculation:**
```
Slot CPM = $2.50 × 0.5 × 1.5 × 0.8 = $1.50
```

---

### Example 3: Super Bowl, Rush Hour, High-Traffic Premium Retailer

| Variable | Value | Source |
|----------|-------|--------|
| Base CPM | `$5.00` | Retailer override (Premium Partner) |
| Traffic Tier | `High` (1.5x) | 5:00 PM is rush hour |
| Date Multiplier | `2.0x` | Major Event override |
| Store Traffic | `High` (1.25x) | High foot traffic store |

**Calculation:**
```
Slot CPM = $5.00 × 1.5 × 2.0 × 1.25 = $18.75
```

---

### Example 4: Hourly Override (Custom Tier)

On a specific date, an admin overrides 2:00 PM from `Medium` to `High`.

| Variable | Value | Source |
|----------|-------|--------|
| Base CPM | `$2.50` | Global Default |
| Traffic Tier | `High` (1.5x) | Hourly override for this date |
| Date Multiplier | `1.0x` | Normal day |
| Store Traffic | `Medium` (1.0x) | Average foot traffic |

**Calculation:**
```
Slot CPM = $2.50 × 1.5 × 1.0 × 1.0 = $3.75
```
*(Without the override, 2:00 PM would have been `Medium` (1.0x), resulting in `$2.50`.)*

---

## 5. Avg Slot CPM (Dashboard Column)

The "Avg Slot CPM" shown in the dashboard is the average price across all screens for a given hour:

```
Avg Slot CPM = Sum of (Slot CPM for each screen) / Total Number of Screens
```

---

## 6. Quick Reference Card

| Factor | Impact | Range |
|--------|--------|-------|
| Base CPM | Foundation | $2.50 - $10.00+ |
| Traffic Tier | Time-of-day adjustment | 0.5x - 1.5x |
| Date Override | Special event boost/discount | 0.75x - 2.0x |
| Store Traffic | Location quality | 0.8x - 1.25x |
| **Combined Range** | Potential price swing | ~0.3x to ~3.75x of Base |
