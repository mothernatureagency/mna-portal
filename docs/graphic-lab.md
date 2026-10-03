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
- `OPENAI_API_KEY` — needed for generated photography. Without it the lab still
  works from uploaded photos and type-led design, but a brand whose creative
  depends on faces will feel the gap; see **Photography** below.

## Brand kits

`/brand-kits` holds the type, colour and rules the lab designs to. Without one
the designer picks a Google Font fresh each time, so two graphics for the same
client can come out in different typefaces — the kit turns typography from the
model's choice into a constraint.

A kit carries: headline and body font (a Google family by name, or an uploaded
`.woff2`/`.ttf`/`.otf`), a named palette, logo files labelled by when to use
them, plus free-text brand rules, voice and imagery direction. The rules are the
part that separates on-brand from merely on-palette — "never put type over the
logo", "prices always in gold" — and they go into the prompt as hard
constraints rather than suggestions.

### Groups

The shape of the problem is franchise-shaped. Every Prime IV location shares the
same wordmark, navy and gold, and headline face; what differs is a phone number
or a photo of that clinic. So a kit belongs either to one client or to a
**group** of them, and a client's own kit stores only the fields it actually
overrides. Resolving a client walks group → client field by field, so a location
inherits the franchise and departs from it only where it means to. In the
editor, an inherited value shows as placeholder text until you type over it.

Group membership is explicit where it's set (the picker at the top of a client
kit) and otherwise derived from the client id — `prime-iv-pinecrest` resolves to
the `prime-iv` group, since that's already how the codebase encodes the
relationship. New groups are created by typing a name under the group list.

### Fonts and licensing

Uploaded fonts go in the public media bucket, which serves them with the CORS
headers `@font-face` and the rasteriser both need. Note that a public bucket
serving a font file is redistribution: plenty of commercial licences, desktop
ones especially, don't permit webfont use. Google Fonts and openly-licensed
faces are safe; check the licence on anything else before uploading it.


## Photography

A wellness brand sells a feeling, and the feeling lives in a face and the light
on it. Type and gradients make a clean offer graphic; they do not make a spa
look like a spa. So generated photography is a first-class part of the lab, not
a nice-to-have.

The generator (`lib/graphic-imagery.ts`) fights the two failure modes that make
AI imagery read as fake at a glance. Every prompt carries craft notes that ask
for real skin texture, real catchlights and real depth of field, and explicitly
rule out the smoothed, waxy, over-retouched look models drift toward. And every
prompt bans text, logos and signage outright, because all the words on a piece
are live DOM text on the artboard — nothing on the finished graphic comes back
misspelled.

Five styles, chosen for this kind of client:

| Style | For |
| --- | --- |
| Real face, close | A person, warm and present. Carries a wellness brand. |
| Surreal + photoreal | Dreamlike setting, entirely photoreal person. |
| Candid lifestyle | Unposed, documentary rather than advertising. |
| The space itself | The drip bar, the treatment room, the light. |
| Texture, no people | Water, silk, botanicals, when type has to carry it. |

Two frames come back per generation and you pick one. Frames of the same brief
differ mostly in the expression, and the expression is the whole job — choosing
beats re-rolling until one lands. "Leave room for type" tells the model which
part of the frame to keep quiet, which is the difference between a photo you
can design on and one you can only look at.

The brand kit's imagery direction is folded into every generation, so a house
look set once carries across every graphic for that client or group.

### The artboard leads with the photo

The design contract is explicit that a piece with a photograph in ASSETS is a
photo with type on it, not a coloured panel with a photo tucked into a corner:
bleed to at least one edge, never cover a face, earn contrast with a gradient
scrim rather than a flat box, and keep the photo big enough to read as a
photograph. A face used too small to tell whether the person is real is a face
that may as well not be there.

### A note on faces

Generated people are fine as mood and lifestyle imagery. They are not fine
standing in for a real client, a testimonial, or a before/after result — that
crosses from styling into a claim about outcomes, which is both a legal problem
in health-adjacent advertising and the kind of thing that erodes trust when
noticed. For anything that implies a real person's experience, use a real photo
with permission.
