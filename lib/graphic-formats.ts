// Canvas sizes the Graphic Lab can build. These are the real export
// dimensions — the artboard is laid out at exactly this size and rasterised
// 1:1, so what the preview shows is what the PNG contains.

export type GraphicFormat = {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Where the artwork ends up — used to steer the design prompt. */
  usage: string;
};

export const GRAPHIC_FORMATS: GraphicFormat[] = [
  { id: 'ig-square',   label: 'Instagram Post (1:1)',    width: 1080, height: 1080, usage: 'Instagram / Facebook feed post' },
  { id: 'ig-portrait', label: 'Instagram Post (4:5)',    width: 1080, height: 1350, usage: 'Instagram feed post, portrait — the highest-reach feed size' },
  { id: 'story',       label: 'Story / Reel Cover (9:16)', width: 1080, height: 1920, usage: 'Instagram / Facebook story or Reel cover' },
  { id: 'carousel',    label: 'Carousel Slide (4:5)',    width: 1080, height: 1350, usage: 'One slide of an Instagram carousel' },
  { id: 'fb-ad',       label: 'Meta Ad (1:1)',           width: 1080, height: 1080, usage: 'Paid Meta ad creative — needs a hard hook and a CTA' },
  { id: 'yt-thumb',    label: 'YouTube Thumbnail (16:9)', width: 1280, height: 720,  usage: 'YouTube thumbnail — must read at 200px wide' },
  { id: 'flyer',       label: 'Flyer / Print (8.5x11)',  width: 1275, height: 1650, usage: 'Printable flyer at 150dpi' },
  { id: 'email-hero',  label: 'Email Header (2:1)',      width: 1200, height: 600,  usage: 'Email campaign hero banner' },
];

export function getFormat(id: string | null | undefined): GraphicFormat {
  return GRAPHIC_FORMATS.find((f) => f.id === id) || GRAPHIC_FORMATS[0];
}
