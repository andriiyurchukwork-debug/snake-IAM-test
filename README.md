# Snake IMA Test

A small browser-based Snake game used to demonstrate a fixed-size Canvas 2D game loop together with Google IMA video-ad lifecycle handling. The application is intentionally focused: the player accepts an initial prompt, watches or bypasses the configured ad flow, plays Snake, and can choose whether to replay after game over.

## Runtime profile

- **Browser:** Chrome only.
- **Canvas:** fixed **1280 × 720 px** game canvas with a **40 × 24** board grid. Each cell is **32 × 30 px**, so the grid fills the canvas exactly. The page centers the fixed-size app shell; it does not implement responsive resizing or mobile controls.
- **Rendering:** HTML Canvas 2D.
- **Language/tooling:** TypeScript, Vite, and Vitest.
- **UI framework:** none. The UI is plain HTML/CSS and TypeScript.
- **Ad SDK:** Google IMA SDK loaded by `index.html`.

## Controls

| Key | Action |
| --- | --- |
| `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` | Change direction while playing |
| `Enter` | Confirm either play prompt |
| `Escape` | Decline either prompt and redirect to the configured URL |

Arrow keys are handled only during `PLAYING`. `Enter` and `Escape` are handled only during the initial and replay prompts. Opposite-direction turns are rejected by the game model.

## Application flow

The controller uses these states:

```text
BOOT
  → PROMPT_PLAY
  → PRE_ROLL_AD       (Enter; first play only)
  → PROMPT_PLAY       (ad complete or fallback)
  → PLAYING           (Enter)
  → GAME_OVER
  → POST_ROLL_AD
  → PROMPT_REPLAY
  → PRE_ROLL_AD       (Enter; replay)
  → PLAYING
```

At startup, the game shows `Do you want to play?` and does not request an ad. The first `Enter` starts the pre-roll request; the game prompt is shown again after the ad completes, so a second `Enter` starts a fresh game. This request is initiated from the keyboard action so the pre-roll display initialization occurs in a user-gesture-gated flow.

The game advances every 120 ms. A wall or self collision ends the run, stops the loop, and starts the post-roll ad. When that ad completes—or when an ad error triggers the fallback—the game shows `Do you want to play again?`. Confirming replay requests another pre-roll, then starts the next run directly in `PLAYING` after the ad completes. Pressing `Escape` from either prompt transitions to `REDIRECT` and navigates to `https://www.google.com`, the URL currently configured in `src/config/appConfig.ts`.

## IMA SDK and fallback behavior

`index.html` loads the Google IMA SDK from `https://imasdk.googleapis.com/js/sdkloader/ima3.js`. `AdModel` creates one IMA display container and reuses its loader for subsequent requests. Each request uses the configured Google test VAST tag in `src/config/adConfig.ts` and requests a 1280 × 720 linear ad slot.

The app treats these IMA outcomes as completion:

- the ad completes;
- the ad is skipped; or
- all ads complete.

If the IMA SDK is unavailable, the request cannot be created, the ad manager emits an ad error, or the request otherwise fails, the error is logged and the controller advances through the same flow without blocking the game. In other words, the ad is best-effort: an ad error is a fallback path to the next prompt, not a fatal application error. The configured VAST tag is a test/demo tag and should be replaced with an authorized production tag for deployment.

## MVC structure

The project keeps game rules, orchestration, input, and rendering separate:

### Models

- `src/models/SnakeGameModel.ts` — Owns the snake, direction rules, food placement, score, collision detection, reset behavior, and immutable render snapshots.
- `src/models/AdModel.ts` — Owns Google IMA setup, ad requests, ad-manager events, request-generation protection against stale callbacks, completion/error callbacks, and resource cleanup.

### Views

- `src/views/GameView.ts` — Configures the 1280 × 720 canvas and renders the board grid, food, snake, and score through Canvas 2D.
- `src/views/PromptView.ts` — Shows and hides the play/replay prompt overlay and updates its message.
- `src/views/AdView.ts` — Shows and hides the ad container and safely pauses/clears the video when hidden.

### Controllers and composition

- `src/controllers/AppController.ts` — Coordinates the application state machine, game interval, prompt transitions, ad transitions, fallback completion, redirect, and cleanup.
- `src/controllers/InputController.ts` — Maps keyboard events to directions, confirmation, and cancellation according to the current `AppState`.
- `src/main.ts` — Validates required DOM elements, constructs the views/models/controllers, and starts the app.

### Configuration and types

- `src/config/gameConfig.ts` — Canvas dimensions, cell dimensions, grid dimensions, and tick interval.
- `src/config/adConfig.ts` — IMA test VAST URL and ad slot dimensions.
- `src/config/appConfig.ts` — Redirect destination.
- `src/types/AppState.ts`, `src/types/Direction.ts` — Application states and movement directions.
- `index.html` — Fixed app shell, prompt/ad DOM elements, inline layout styles, and the external IMA SDK script.

## Local development

From the project directory:

```bash
npm install
npm run dev
```

The Vite development server prints its local URL. Open the app in Chrome.

Available commands:

```bash
npm test          # Run the Vitest test suite once
npm run build     # Type-check and create the Vite production build
npm run preview   # Serve the production build locally
```

`npm run preview` is intended to inspect the generated build after `npm run build`; it is not a production server.

## Deployment requirements

Deploy the built static site over **HTTPS**. The app depends on an external IMA SDK and a network VAST request, and production ad playback should be exercised in a secure, Chrome environment. The deployment must preserve the external SDK script access and allow the configured ad request; restrictive Content Security Policy, proxy, or ad-blocking rules can prevent ads from loading. Because the canvas is fixed at 1280 × 720, the hosting page should provide a viewport where that full size is usable.

## Known limitations

- Chrome is the supported browser; cross-browser compatibility is not a project goal.
- The canvas and app shell are fixed at 1280 × 720 and do not scale responsively.
- Input is keyboard-only; touch, mouse, gamepad, pause, and accessibility control layers are not implemented.
- The IMA SDK and VAST ad depend on external network availability and browser/ad-blocking policy.
- Ad failures intentionally bypass the ad and continue the game flow; the app does not retry or expose an in-game error message.
- The current configuration uses a Google test VAST tag and redirects declined prompts to `https://www.google.com`.
- Score and game progress are in-memory only and are lost when the page is reloaded.
- There is no production analytics, consent-management flow, server-side state, or persistent storage.
