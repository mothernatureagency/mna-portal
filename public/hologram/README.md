<img width="1161" height="1354" alt="goddess" src="https://github.com/user-attachments/assets/4b98b9f4-7393-4e4e-b0f3-4ed16a1f85a6" />
# Mother Nature hologram artwork

Drop the goddess image here as **`goddess.png`** (the blue water/nature figure).

- Path the app loads: `/hologram/goddess.png`
- Until the file exists, the assistant falls back to the animated SVG hologram.
- Eye/mouth blink + talk positions live in `components/ai/JarvisFab.tsx`
  (`.goddess` CSS vars: `--eye-y`, `--eye-l`, `--eye-r`, `--mouth-y`, `--mouth-x`).
