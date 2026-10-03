// Imagery direction for the Graphic Lab.
//
// A wellness spa sells a feeling, and the feeling lives in faces and light —
// not in gradients. So the generated layer has to come back photoreal: real
// skin with texture in it, real catchlights, real depth of field. Left to
// itself an image model drifts toward the plasticky, over-retouched look that
// reads as fake at a glance, so every preset below fights that explicitly.

export type ImageryStyle = {
  id: string;
  label: string;
  hint: string;
  /** Appended to the user's subject to steer the look. */
  direction: string;
};

/** Craft notes that go on every generation, whatever the style. */
export const PHOTOREAL_BASE = [
  'Photorealistic photograph, not an illustration and not a 3D render.',
  'Real human skin with visible texture, pores and fine lines - never smoothed,',
  'waxy or plastic. Natural catchlights in the eyes. Shot on a full-frame camera',
  'with an 85mm lens at a wide aperture, so the subject is sharp and the',
  'background falls away softly. Colour graded gently, never oversaturated.',
].join(' ');

/** What must never appear, because the artboard supplies all of it as live text. */
export const NEGATIVE_DIRECTION = [
  'No text, no words, no letters, no numbers, no signage, no logos, no',
  'watermarks, no UI elements, no borders or frames. Hands and fingers must be',
  'anatomically correct or kept out of frame entirely.',
].join(' ');

export const IMAGERY_STYLES: ImageryStyle[] = [
  {
    id: 'portrait',
    label: 'Real face, close',
    hint: 'A person, warm and present. The one that carries a wellness brand.',
    direction:
      'A close, warm portrait of a real-looking person mid-moment - a small genuine expression, not a stock-photo grin. Soft directional window light from one side, gentle falloff into shadow. Calm, rested, unmistakably a real human being.',
  },
  {
    id: 'surreal',
    label: 'Surreal + photoreal',
    hint: 'Dreamlike and elevated, but the person still reads as real.',
    direction:
      'Dreamlike and quietly surreal, yet photographic: a real person rendered with complete photographic realism, placed in an impossible calm - suspended water, weightless botanicals, soft mist, light that falls from nowhere. Ethereal but never cartoonish or illustrated. The skin, the eyes and the hair stay entirely photoreal; only the world around them is strange.',
  },
  {
    id: 'candid',
    label: 'Candid lifestyle',
    hint: 'Unposed, in the moment. Reads as documentary, not advertising.',
    direction:
      'Candid and unposed, caught mid-gesture as if the subject had not noticed the camera. Natural available light, a little motion in it, slightly imperfect framing. Documentary rather than advertising.',
  },
  {
    id: 'clinic',
    label: 'The space itself',
    hint: 'The drip bar, the treatment room, the light through the blinds.',
    direction:
      'The interior of a calm modern wellness clinic - clean lines, warm wood and soft neutrals, daylight through sheer blinds. A person may be present but small in frame, out of focus, incidental. Architectural and serene.',
  },
  {
    id: 'texture',
    label: 'Texture, no people',
    hint: 'Water, silk, botanicals. For when type has to carry the piece.',
    direction:
      'A close abstract texture with no people in it at all - water surface, silk, eucalyptus, steam, stone, light through glass. Shallow focus, generous soft areas where a headline can sit.',
  },
];

export function getImageryStyle(id: string | null | undefined): ImageryStyle {
  return IMAGERY_STYLES.find((s) => s.id === id) || IMAGERY_STYLES[0];
}

/**
 * Assemble the full generation prompt. `composition` asks the model to leave
 * somewhere for the headline to live, which is the difference between a photo
 * you can design on and one you can only look at.
 */
export function buildImagePrompt(opts: {
  subject: string;
  styleId?: string;
  brandNote?: string;
  /** Where the type will sit, so the model leaves it quiet. */
  copySpace?: 'top' | 'bottom' | 'left' | 'right' | 'none';
}): string {
  const style = getImageryStyle(opts.styleId);
  const parts = [
    opts.subject.trim(),
    style.direction,
    PHOTOREAL_BASE,
    opts.brandNote?.trim() ? `Brand context: ${opts.brandNote.trim()}` : '',
    opts.copySpace && opts.copySpace !== 'none'
      ? `Compose so the ${opts.copySpace} of the frame stays quiet and uncluttered - a headline will be set over it.`
      : '',
    NEGATIVE_DIRECTION,
  ];
  return parts.filter(Boolean).join('\n\n');
}
