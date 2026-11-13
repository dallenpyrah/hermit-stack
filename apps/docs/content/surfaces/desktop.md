---
title: "Desktop"
description: "An Electron shell whose main process is an Effect program, around the server-rendered web app."
status: planned
---

The desktop app will be `apps/desktop/**`: an Electron shell whose main process is an Effect program, loading the server-rendered web app, with every native capability behind a port.

## The design

```text
Sketch of the planned shape:

 renderer (FoldKit, the web app)
      │  Effect RPC group over IPC          typed both ways, the same pattern as the Api
      ▼
 main process: one Effect program
      Layer per port ── Updates · Window · DeepLink · Keychain · Notifications · FileSystem · Tray
                         each port: a live Layer (Electron), a fake Layer, one contract suite
```

- **The window renders FoldKit.** The desktop app owns only what a browser tab cannot do.
- **The web app does not branch on where it runs.** It sees native features as Commands and Subscriptions behind a `Desktop` service, which has a no-op Layer in the browser.
- **Load by URL by default.** The window loads the deployed origin, so first paint is the server render, cookies work and a deploy updates every desktop at once. A bundled mode for offline start is a later option.
- **The IPC group is an allow list**, and each call checks the sender's origin.

## Options considered

| Option                                     | Gains                                                                        | Loses                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Electron, Effect main process** (chosen) | The main process is Node, so it is Effect. One rendering engine on every OS. | The largest download and memory use.                           |
| Electrobun                                 | TypeScript main process, small download.                                     | A different system webview per OS means three engines to test. |
| Tauri                                      | Smallest; also targets phones.                                               | The native side is Rust, so native services are not Effect.    |

A fully native desktop app is not offered: it would drop FoldKit, which always stays.

## What will prove it works

- A contract suite per port, run against its fake and its Electron Layer.
- The web app's Scene tests pass with the no-op `Desktop` Layer.

## The catches

- A page loaded from the network that can call native code is the main security risk; the allow list and origin checks are the defence.
- Signing, notarising and auto-update per OS is real work the template can only partly prepare.
