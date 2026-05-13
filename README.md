# Calorimetria: neutralizacion

Demo app for estimating the corrected temperature change in calorimetry curves.

## Run

```bash
bun install
bun run dev
```

The server defaults to `http://localhost:49152/`. To use another port:

```bash
PORT=5200 bun run dev
```

## Cloudflare Workers

Run locally with Wrangler:

```bash
bun run cf:dev
```

If the default Wrangler port is busy:

```bash
bun run cf:dev -- --port 49153
```

Deploy to Cloudflare Workers:

```bash
bun run cf:deploy
```

## Features

- Three built-in model datasets:
  - cold water plus boiling water,
  - acid diluted in water,
  - acid added to base solution.
- CSV paste input with two columns: `tiempo, temperatura`.
- Adjustable addition time, initial fit region, final fit region, and corrected time.
- Live extrapolated lines, shaded areas, equal-area button, and corrected `Delta T`.
