---
title: "Mobile"
description: "SwiftUI and Compose apps, clients of a hand-written public HTTP API through generated clients."
status: planned
---

The phone apps will be native: SwiftUI in `apps/ios/**` and Jetpack Compose in `apps/android/**`. They are clients of a hand-written public HTTP API, with clients generated from one checked-in OpenAPI document.

## The design

```text
Sketch of the planned path:

 Api ─▶ public HTTP API ─▶ clients/openapi/public.json ─┬▶ swift-openapi-generator ─▶ apps/ios
        (hand-written,      (checked in; CI fails on     └▶ an OpenAPI generator ─▶ apps/android
         calls the Api       drift or a breaking diff)
         in process)
```

- **Hand-written, not derived.** A store app cannot be redeployed with the server, so its contract needs its own response schemas and its own version. This follows Alchemy's advice for any public API. The derived JSON routes in `services/api` stay for internal tools.
- **Reads are `GET`.** Effect's OpenAPI output puts `QUERY` operations under an extension that generators may skip.
- **Live reads are Server-Sent Events.** A phone gets the same snapshot-then-resume flow as the browser, without the RPC protocol.
- **Auth is a bearer token** on the same `Session` middleware the browser uses with a cookie.
- **Push is a separate port.** Live updates reach a phone only while the app is open; anything that must reach a closed app goes through the Push port, with APNs and FCM adapters.
- **Design tokens become data.** One source file will generate the StyleX variables, a Swift asset catalogue and a Compose theme.

## What will prove it works

- The OpenAPI document is generated in `pnpm check` and a diff against the checked-in copy fails the check.
- A wire spec (cases as data: a request and its expected response) runs against the public API, which is what a second language makes worth keeping.

## The catches

- The rules in `tools/rules` are for TypeScript. Swift and Kotlin bring their own lint and format tools, and "everything is Effect" stops at the HTTP boundary.
- A released app pins a contract, so the public API needs a version and a deprecation rule before the first store release.
- iOS builds need macOS CI runners. Bazel is still not needed: the only shared build edge is one generated file.
