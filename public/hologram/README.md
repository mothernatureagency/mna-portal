# Mother Nature hologram artwork

Drop the goddess image here as **`goddess.png`** (the blue water/nature figure).

- Path the app loads: `/hologram/goddess.png`
- Until the file exists, the assistant falls back to the animated SVG hologram.
- Eye/mouth blink + talk positions live in `components/ai/JarvisFab.tsx`
  (`.goddess` CSS vars: `--eye-y`, `--eye-l`, `--eye-r`, `--mouth-y`, `--mouth-x`).
