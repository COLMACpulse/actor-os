# ACTOR OS

Self-tape field unit for actors. Prep, shoot, cut, send — on the phone you already
have. No account, no server, no upload. Runs offline once installed.

**Live:** https://YOURUSERNAME.github.io/actor-os/

---

## The five stages

    01 PREP   02 SHOOT   03 CUT   04 SAVE   05 SEND
       o         o          o        o         o

They are a real sequence, so they are numbered. Each carries its own state, which
makes the row a status line rather than a set of tabs: hollow means nothing there
yet, amber means started, green means done. The active stage gets a tally light
across the top &mdash; the same signal a camera gives when it is the one that is live.

## What it does

| stage | |
|---|---|
| **PREP** | Upload your sides — **PDF, text or paste**. That is the only required step; everything else runs off them. |
| **SHOOT** | Press record and you get **3 &middot; 2 &middot; 1 &middot; ACTION** to get set. Nothing is captured during the count. Tap to cancel. |
| **SHOOT (cont)** | One question: *how are you shooting this?* Then the screen goes full and shows only what that answer needs. |
| **SAVE** | Get the performance onto the phone before anything else. Every take is marked saved or browser-only. |
| **CUT** | Takes marked DROP / HOLD / SURVIVOR. Non-destructive trim against an untouched master. Video is held in IndexedDB, so takes survive a reload. |
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

## The five stages

    01 PREP   02 SHOOT   03 CUT   04 SAVE   05 SEND
       o         o          o        o         o

They are a real sequence, so they are numbered. Each carries its own state, which
makes the row a status line rather than a set of tabs: hollow means nothing there
yet, amber means started, green means done. The active stage gets a tally light
across the top &mdash; the same signal a camera gives when it is the one that is live.

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

Mark where the scene starts and ends, drop any character who is not in it, then
hit **READY** to lock the scene. Only then does the booth appear &mdash; so you never
record a line that is not in your scene.

Each line records as many takes as you want. Listen back, keep the one you like,
delete the rest. When every line has a take you can **play the whole read** back to
back &mdash; the entire other side of the scene, in your voice.

On a real four-page side that is 10 lines instead of 23.

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

Handles `FlateDecode`, `ASCII85Decode`, `ASCIIHexDecode`, filter chains, hex
strings from composite fonts, `ToUnicode` CMaps for subset fonts, and PDF 1.5+
object streams.

Real sides carry a lot that is not the scene. These are stripped: the diagonal
security watermark, production headers, scene numbers in both margins, page
footers, `(CONTINUED)`, `START`/`END`/`FYI` markers, and the self-tape
instructions page.

Breakdown Services names the file after the part, so `GURAM_DADIANI.pdf`
preselects GURAM automatically.

**Scanned sides have no text in them** — they are pictures of pages. The app says
so plainly instead of returning an empty result that looks like a bug.

## Marking where the scene starts and ends

Casting marks the range on your sides &mdash; usually **by hand**. Handwriting is
ink on the page: there is no text in the file to find, so no parser can detect it.
Anyone claiming otherwise is guessing.

So you mark it. Tap a line for **START**, tap another for **END**. Everything
outside the range dims but stays readable as context, and the marks are stored
against that file &mdash; set them once and they persist.

It matters more than it sounds. On a real four-page side, marking the range took
the reader booth from **23 lines to record down to 10**.

## Slate move &mdash; optional, off by default

Casting wants a full body slate for physicality and a closer frame for the read.
Most home setups do not have the floor space to shoot wide, so coaches teach a
manual punch-in and record tutorial videos explaining it. No self-tape app
automates it.

Shoot **one static full-body slate**. The app punches in from head-and-shoulders
to full body, **holds**, then settles closer.

**Nothing is generated** &mdash; every output pixel is crop and scale over your own
frame. But nothing generated is not the same as nothing softened. A crop is fewer
pixels, and stretching them to the output size is an upscale:

    1080p slate, tightest crop -> 806x454 to 1920x1080 = 2.38x. Soft.
    4K    slate, tightest crop -> 1612x907 to 1920x1080 = 1.19x. Fine.

So the app measures the real cost, **refuses** above 1.35x rather than shipping a
mushy tape, and asks the camera for the largest frame available when the move is
enabled.

**On focus:** cropping cannot change focus. Whatever the lens did during the static
slate is baked in, and the punch-in magnifies it. Lock focus and exposure before
you shoot the slate &mdash; nothing downstream can fix a hunt.

**The hold is not decoration.** A casting director on full-body slates: *no
pan-and-scan, because it does not give us an overall view of your full body.* The
hold is that overall view. Offices disagree on whether to move at all, which is
why this is **off by default** and why the breakdown always wins.

## Slate card, not a watermark

Casting instructions routinely read: *do not edit video with cross-fades or labels
on the actual scene (labels before the scene are fine)*.

So **nothing is ever composited onto a take.** Instead the app draws a slate card —
your name, the role, the project, and an optional QR to your page. Hold it in
frame before the scene, or save it as an image and shoot it as your slate file.

The QR is generated in-app with no library, and it is a real, scannable symbol —
verified byte-identical to a reference encoder and decoded back to the URL.

## File naming

Files come out the way Actors Access names them, so a casting office sees the
convention it expects:

    BRENDAN McCARTHY_Guram_Slate.mp4
    BRENDAN McCARTHY_Guram_Tk1.mp4
    BRENDAN McCARTHY_Guram_Tk2.mp4

## Your takes belong on your phone, not in a browser

Browser storage is a cache. Safari can clear it without warning, and a web app
gets a few hundred MB at best. **A take that only exists in IndexedDB is not
saved.**

So every take gets a **SAVE TO PHONE** button the moment you stop recording.
On iOS that opens the share sheet, where *Save Video* writes to Photos - the camera
roll, same as anything the phone shoots. Everywhere else it downloads to Files.

Files are named for the work: `THE_LAST_LIGHT_GURAM_T1_20260828_1817.mp4`

Every take is marked **saved to phone** or **browser only**, and CUT shows a
standing banner listing anything not yet off the device. The app will not let you
forget a take it cannot promise to keep.

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
