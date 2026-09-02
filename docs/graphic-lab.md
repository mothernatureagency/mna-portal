# Graphic Lab

The Video Lab's counterpart for static creative — except this one makes the
artwork, not a brief for someone else to make it.

Before this, "request a graphic" on a content calendar post raised a task and
(optionally) had the Graphic Designer agent draft a spec. Someone still had to
open Canva. The Graphic Lab closes that loop: the agent builds the finished
piece, you push it around until it's right, and the PNG lands on the post.

## How a piece gets made

1. **Start it** — `/graphic-lab` → *+ New Graphic*, or *Make it* from the
   Artwork panel of any post in the Content Tracker (which carries the post's
   title, caption and a best-guess canvas size across, and links the two so the
   finished art attaches itself).
2. **Give it direction** — subject, headline, subhead, CTA. All optional; with
   none of it the designer writes the copy from the title alone. *Draft the
   brief first* writes the written spec if the piece needs signing off in words.
3. **Add assets** (optional) — paste a link, upload a photo, or generate a
   background. With no assets the piece is built entirely from typography,
   gradients and shapes, which is usually the stronger option for an offer.
4. **Build the artwork** — the agent returns a complete artboard.
5. **Revise** — plain English ("headline much bigger", "drop the photo"). *Keep
   the current layout* limits it to what you asked for. Every earlier version is
   restorable.
6. **Render** — rasterises to PNG at the format's real export size, saves it to
   the media bucket, and attaches it to the linked post — which closes the open
   "needs a graphic" task the same way a manual upload does.

## Why HTML and not an image model

The artboard is a self-contained HTML document laid out at exactly the export
dimensions (`lib/graphic-formats.ts`), rasterised in the browser with
`html-to-image`. That trade buys the three things diffusion models reliably ruin
on creative that carries a headline and a phone number: type stays crisp and
correctly spelled, brand hex codes come out exact, and every layer stays
editable afterwards — including by hand, in the **Artboard** tab.

Rendering happens client-side because the browser is the only place the fonts,
the layout and the images all exist at once. The preview iframe is scaled with a
CSS transform to fit the panel; the export builds a throwaway iframe at true
size, so the preview and the PNG can't drift apart.

Every image the artboard references is relayed through
`/api/graphic-projects/proxy-image` so it's same-origin — a cross-origin photo
without CORS headers taints the canvas and the export dies. Drive share links
get normalised to their preview endpoint on the way through.

## Routes

| Route | Does |
| --- | --- |
| `/api/graphic-projects` | CRUD, shaped like `/api/video-projects` |
| `/api/graphic-projects/design` | Builds or revises the artboard (Opus) |
| `/api/graphic-projects/brief` | Drafts the written spec |
| `/api/graphic-projects/render` | Stores the PNG, attaches it to the post |
| `/api/graphic-projects/image` | Optional AI photo layer |
| `/api/graphic-projects/proxy-image` | Same-origin asset relay |

## Environment

- `ANTHROPIC_API_KEY` — required, same key the rest of the agents use.
- `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` — required to save renders
  (same `content-images` bucket the content tracker uploads to).
- `OPENAI_API_KEY` — **optional**, only for generating photo backgrounds. Without
  it that one button returns a 503 explaining as much and everything else works,
  the same way the Video Lab degrades without HeyGen.
