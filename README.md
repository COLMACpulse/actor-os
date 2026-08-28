# ACTOR OS

Self-tape field unit for actors. Prep, shoot, cut, send — on the phone you already
have. No account, no server, no upload. Runs offline once installed.

**Live:** https://YOURUSERNAME.github.io/actor-os/

---

## What it does

| stage | |
|---|---|
| **PREP** | Upload your sides — **PDF, text or paste**. That is the only required step; everything else runs off them. |
| **SHOOT** | One question: *how are you shooting this?* Then the screen goes full and shows only what that answer needs. |
| **CUT** | Takes marked DROP / HOLD / SURVIVOR. Non-destructive trim against an untouched master |
| **SEND** | One package with a slate, the survivor take, and a delivery receipt |

### Three ways to shoot, and you only ever see one

**With a reader** — someone off camera is reading with you. The screen is the frame
and a record button. Nothing else.

**Scene partner** — **you record every other character yourself**, in PREP, in your
own voice at your own pace. The take plays those back and hands you the floor.

No synthetic voice. A robot reader gives you nothing to play against — your own
reading carries the rhythm and the intention you actually want to work off. The
actor is the machine.

Your line is never shown in this mode. You are acting, not reading.

**Teleprompter** — your lines on screen at whatever level you want.

### The prompter has six levels and you pick

`FULL LINE` · `FIRST PHRASE` · `FIRST WORD` · `INITIALS` · `CUE ONLY` · `OFF`

`INITIALS` renders *"I don't know what you're talking about. I wasn't even there."*
as `IDKWYTA. IWET.` — punctuation kept, so the shape of the line survives when the
words are gone.

**The system never hides text based on a readiness judgment.** You choose the level.

### Cue matching that refuses to guess

Confidence is `0.45·token + 0.35·coverage + 0.20·tail`.

- `≥ 0.82` — MATCH, advance
- `0.65 – 0.82` — **HOLD**, wait for you
- `< 0.65` — NO MATCH

A near-miss like *"I ain't your brothers okay"* against *"I ain't your brother"*
scores 0.76 and **holds**. It would rather stall than advance on a mis-hear.

---

## What it does not claim

This is the part that matters.

- **It does not measure your framing.** No headroom, no eyeline, no body position.
  Without a verified face detector those values are UNKNOWN, and the app says so
  rather than guessing.
- **It does not judge your acting.** Selection and sequencing only. The survivor
  packet carries that sentence inside the data.
- **It does not simulate native capture.** Cinematic mode activates only where the
  device actually reports the capability. Android reports it unsupported rather
  than passing off a blur effect as the same thing.
- **It does not fabricate device support.** UNKNOWN beats a plausible-looking pass.

---

## Install it on your phone

1. Open the live URL in **Safari** (iOS) or **Chrome** (Android)
2. **Share → Add to Home Screen**
3. Launch from the icon — full screen, no browser bar

**The camera needs `https://`.** On a plain `http://` address the browser blocks it
silently. The app shows a red bar when that happens so it does not look like a
crash.

---

## Reader booth

After you pick your character, PREP lists every line that is not yours with a
record button. Record them once; they are stored against the content of the line,
so re-uploading the same sides keeps the recordings.

If a line has no recording the take says **"not recorded"** rather than
substituting a machine voice.

## Reading a PDF

Sides arrive as PDFs, so the app reads them directly. No library — browsers ship
`DecompressionStream`, which is the only hard part of a PDF content stream.

It reads **positions, not just text**, and screenplays are positional:

```
 108pt  INT. APARTMENT - DAY              <- action / slug
 266pt  JULIE                             <- character cue
 180pt  Nobody here saw anything.         <- dialogue
 216pt  (not looking up)                  <- parenthetical
```

Character cues sit at ~3.7in, dialogue at ~2.5in, action at ~1.5in. Using the
indent makes the parse **more** reliable from a PDF than from pasted text, because
nothing depends on guessing at capitalisation.

Handles `FlateDecode`, `ASCII85Decode`, `ASCIIHexDecode` and filter chains.

**Scanned sides have no text in them** — they are pictures of pages. The app says
so plainly instead of returning an empty result that looks like a bug.

## Storage

The browser gives a web app a few hundred MB and can clear it without warning. At
roughly 1 MB per second of 1080p that is a few minutes of footage.

**Treat the phone as capture, not as an archive.** Get takes off the device the
same day.

A native build with a real master vault — create-once files, SHA-256 receipts,
read-only hardening — exists in source and needs a Mac to compile.

---

## Gauntlet

`gauntlet/PHYSICAL_DEVICE_GAUNTLET.html` — twelve tests covering permissions,
enumeration, focus, exposure, cinematic detection, master recording, hash
verification, kill/relaunch persistence, storage and battery edges, and a
ten-master endurance run.

Every test starts UNKNOWN and only moves on evidence. **UNKNOWN is not a pass.**

---

## Running locally

Any static server. It must be `https` or `localhost` or the camera will not open.

```bash
python -m http.server 8080
# then open http://localhost:8080
```

---

## Updating

Push to `main` and Pages redeploys. **Bump `CACHE` in `sw.js`** or installed phones
keep serving the old build with no sign anything changed.

---

## Built with

Nothing. No framework, no build step, no dependencies. Plain HTML, CSS and
JavaScript in a folder.
