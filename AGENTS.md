# Working agreement for agents

Read this before changing a demo. It records feedback from real review rounds, so
treat each rule as a bar to clear, not a suggestion. Copy the shipped demo
(`src/pages/status-thread/`) for structure, but where it falls short of a rule
here, follow the rule.

## Before you say "done"

Run these in order. Skipping one is how past bugs shipped.

1. `nvm use` (Node from `.nvmrc`; Astro refuses older versions).
2. `pnpm exec astro check` and `pnpm build` are clean.
3. Serve the build: `pnpm exec astro preview --port 4401`.
4. Run the end-to-end pass below at **1440×900, 1280×720 and 390×844**, in
   **light and dark** system themes, and once with reduced motion.
5. Open the screenshots and look at them yourself.
6. Report what you tested, what you didn't, and anything that failed. Lead with the result.
7. Open the demo's local preview in the user's browser (`open http://localhost:4401/lab/<slug>/`)
   so they can look right away. Do this every time you finish a change, without being asked.
8. Stop. Don't commit or push until the user says so (see Process).

## The standard: every demo is world-class

A demo exists to make one idea feel effortless. If a detail distracts from that
idea, remove it.

### Focus

- **Show the effect, not the interface around it.** Use the icon or effect in the
  few places it means something. Cut chrome that doesn't help the viewer watch the
  effect: extra icons, menus, status bars, device details, result chips, step cards.
- **For each placement of the effect, ask: would the demo lose something without
  it?** If not, remove it. Don't put the mark inside every control.
- **Minimal text.** No explainer sections or "how to use" blocks inside a demo.
- **When imitating a known product** (a chat app, a voice assistant), match its
  layout and where its loaders sit. Don't approximate.

### Layout stability

- **Nothing already on screen moves when something new arrives.** Reserve space up
  front. New content fills reserved space or overlays; it never pushes neighbours.
- **Word-by-word text is laid out first, then revealed.** Put every word in the DOM
  invisible (`opacity: 0`), then fade each in. Otherwise centred or wrapping text
  re-flows and re-centres on every word. Exception: a caret that follows the text,
  where words are added as they arrive (left-aligned fields).
- **A control may fit its label** (a button reads "Generate", "Generating…", "Done"),
  but when its width changes, animate `width` over about 0.3-0.4s and move nothing
  else: neighbours and the control's own position stay put. Never snap. Don't fix
  the width to the longest label; that looked wrong and was rejected. This
  deliberately overrides the general advice not to animate a shift: here the
  change is the control's own, so animating it is correct. Known gap: while the
  width grows, the new label can clip briefly. If you touch this, fade the label in
  as the width opens.
- **Give text areas a fixed height** when their content varies (for example a
  3-line caption box), so long text never moves what's above or below.

### Motion and finish

- **Softness matches the effect.** Text entrances are a fade of 0.5s or less with at
  most 2px of blur. Heavier blur reads as mist and was rejected.
- **No fade or gradient "mist" behind the chat composer.** It sits on a solid edge.
  Use gradients elsewhere only when they help.
- **Judge optical size, not bounding boxes.** A shape whose tips poke past the
  others' circle reads as bigger. The X's tips are 0.41 from centre against the
  ring's radius of 0.58 for this reason. Compare shapes side by side at real size.
- **Anything shown at 16-24px must stay legible.** Few moving parts; simplify
  rather than scale down. The coil was replaced by a plain arc for exactly this.
- **Honour reduced motion** (`prefers-reduced-motion: reduce`): no fades, no
  glides, no loops that need motion to make sense.

### Dark, centred and contained

- **A demo owns its colours.** A dark demo must look dark whatever the visitor's
  system theme. The frame (`LabLayout.astro`) switches light and dark itself, so
  override its tokens with higher specificity and declare the scheme:
  `html:root { color-scheme: dark; --lab-bg: ...; }` and
  `html:root, html:root body { background: ... }`. Test with light emulation.
- **Name demo classes distinctively.** The frame's styles are global; a generic
  name like `.bar` silently restyled the frame and broke the tab pill's centring.
  Use a demo prefix or a specific name (`.appbar`).
- **Fit the viewport.** At 1440×900, 1280×720 and 390×844, nothing sits under the
  frame's brand and Share buttons, nothing scrolls sideways, and the layout
  reflows sensibly (phones get one column).

## End-to-end testing

Type checks and a build are not testing. Drive the built site in a real browser
like a user.

- **Tool:** the ego-browser CLI. Run `ego-browser skill` and follow its output, then
  script with `ego-browser nodejs`. The skill includes the Chrome DevTools Protocol
  calls used below (`page.cdp(...)`).
- **Viewport:** the test browser can report a smaller viewport than you ask for.
  Procedure: call `Emulation.setDeviceMetricsOverride` with the size you want, read
  `innerWidth` and `innerHeight`, and scale the override by the ratio you
  observe until they match. (On the machine used so far, 2160×1350 gave a
  1440×900 viewport; the ratio depends on the browser, so measure it.) Use
  `Page.captureScreenshot` for images; `page.screenshot` can crop.
- **Colour schemes:** `Emulation.setEmulatedMedia` with `prefers-color-scheme`
  `light`, then `dark`. A dark-only demo must stay dark in both.
- **Reduced motion:** emulate `prefers-reduced-motion: reduce` and confirm nothing
  needs motion to make sense and text still appears.
- **Coverage:** every tab, state and flow. Tabs and keyboard navigation (arrow keys),
  pickers, each scripted story start to finish including failure and recovery,
  skip/restart controls, looping.
- **Assert what has broken before:** positions and sizes stay constant while content
  changes (sample `getBoundingClientRect` over time); text colour contrasts with its
  background; no sideways scroll; no script errors (collect them with
  `Page.addScriptToEvaluateOnNewDocument`).
- **Wait for conditions, not fixed delays.** Poll until the thing you expect
  appears, with a timeout. Fixed sleeps made tests fail for the wrong reason.
- **After any deploy,** load the live URL with light emulation and check the
  computed `color-scheme` and background. The white-background bug only showed up live.
- **Never claim a check you didn't run.** Say what was and wasn't covered.

## Process

- **Don't push or deploy until told.** A push to `main` deploys to
  `delightly.dev/lab`. Commit and push only when the user says "push" or "deploy";
  approval for one push doesn't cover the next. If the user asks for a push in the
  same message as the work, that counts.
- **Clean up after yourself.** Remove dead code and files your change leaves
  behind. Delete a whole project only when the user asks.
- Keep summaries short and plain; lead with the result.
