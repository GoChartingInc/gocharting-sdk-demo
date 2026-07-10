# GoCharting SDK Demo

A React (Create React App + CRACO) demo application showcasing the
[`@gocharting/chart-sdk`](https://www.npmjs.com/package/@gocharting/chart-sdk).
It includes a multi-page navigation system with several chart examples — see
[`NAVIGATION.md`](./NAVIGATION.md) and
[`ADVANCED_TRADING_EXAMPLE.md`](./ADVANCED_TRADING_EXAMPLE.md).

## Branch Strategy

This repository uses two branches with **different SDK wiring**. Pick the branch
that matches what you're doing:

| Branch | Purpose | SDK source |
| --- | --- | --- |
| **`main`** | Test the demo against the **published SDK from npm** | `@gocharting/chart-sdk` (pinned npm version) |
| **`develop`** | **Local development** against a checkout of the SDK | `@gocharting/chart-sdk` resolved from a local folder |

> Keep changes to SDK-source wiring (`package.json` dependency,
> `craco.config.js` alias, `sdk.config.js`) on the branch they belong to — do not
> merge local-dev wiring from `develop` into `main`.

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)

---

## `main` — Test using the SDK from npm

On `main`, the SDK is consumed as a normal published dependency
(`"@gocharting/chart-sdk": "<version>"` in `package.json`). No local SDK checkout
is required.

```bash
git checkout main
pnpm install
pnpm start          # runs on http://localhost:3000
```

To test a different published SDK version, bump the version in `package.json` and
reinstall:

```bash
pnpm add @gocharting/chart-sdk@<version>
pnpm start
```

---

## `develop` — Local development for gocharting-sdk

On `develop`, the SDK is resolved from a **local checkout** so you can develop the
demo and the SDK side by side. The demo expects the SDK repository to sit next to
this one:

```
parent/
├── gocharting-sdk-demo/            # this repo (on `develop`)
└── gocharting-web-sdk/GoCharting-SDK/
```

The wiring lives in:

- `package.json` → `"@gocharting/chart-sdk": "file:../gocharting-web-sdk/GoCharting-SDK/dist"`
- `craco.config.js` → webpack alias pointing `@gocharting/chart-sdk` at the local
  SDK `dist/`

### Setup

```bash
git checkout develop
pnpm install
```

### Build the SDK and run the demo

```bash
pnpm run build:sdk      # builds the local SDK (build:webpack)
pnpm start              # runs the demo on http://localhost:3000
```

Or do both in one step (build SDK, reinstall, start):

```bash
pnpm run build:start
```

> If you change the local SDK path, update it in **both** `package.json` and
> `craco.config.js`.

---

## Available Scripts

| Script | Description |
| --- | --- |
| `pnpm start` | Run the demo in development mode (http://localhost:3000). |
| `pnpm run build` | Production build into `build/`. |
| `pnpm test` | Run the test runner in watch mode. |
| `pnpm run build:sdk` | Build the local SDK (`develop` workflow). |
| `pnpm run build:start` | Build the local SDK, reinstall, then start (`develop` workflow). |

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [CRACO documentation](https://craco.js.org/)
- [React documentation](https://reactjs.org/)
