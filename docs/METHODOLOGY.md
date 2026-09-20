# Methodology and limits

## The model

Each cell holds a value A in [0, 1]. Each step:

```
U  = (K * A) / sum(K)                    ring-shaped kernel, toroidal wrap
G(U) = 2 exp(-(U - mu)^2 / (2 sigma^2)) - 1
A  = clamp(A + dt * G(U), 0, 1)
```

## The classifier

Each trial reports three numbers, measured on the whole grid:

- **mass**: mean cell value
- **coverage**: share of cells above 0.1
- **activity**: mean absolute change per step over cells above 0.02

| Class | Rule |
|---|---|
| extinct | final mass below 0.003 |
| saturated | final mass above 0.45 |
| static | activity below 0.0008 |
| alive | everything else, scored from 0 to 1 |

The alive score is the product of three terms: how active the pattern is (saturating at 0.004), how close coverage is to 6%,
and how steady the mass is between the halfway point and the end. These thresholds are engineering choices, not measured constants.

## Threats to validity

- Results depend on the seed. A genome that is alive for one seed can die for another. The exported CSV records the seed.
- Three hundred steps can be too short for slow structures and too long for fast blow-ups.
- Coverage near 6% favours compact structures and can undervalue spread-out life.
- Single-precision floats and different GPUs can change trajectories of chaotic runs.

## Suggested experiments

1. Survey the same genome family over ten seeds and report how often each cell is alive.
2. Compare Discover against random search with the same trial budget.
3. Vary the trial length and measure how the phase map changes.

## Reference

Chan, B. W.-C. (2019). Lenia: Biology of Artificial Life. *Complex Systems*, 28(3), 251–286.
