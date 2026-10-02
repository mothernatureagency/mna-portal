/**
 * One-page PDF copy of an invoice, attached to the invoice email.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const BLUE = rgb(0.047, 0.427, 0.643); // #0c6da4
const DARK = rgb(0.2, 0.2, 0.2);
const GREY = rgb(0.53, 0.53, 0.53);
const LINE = rgb(0.9, 0.9, 0.9);

// Standard PDF fonts only cover Windows-1252; drop anything else rather than throw.
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function safe(s: unknown): string {
  return Array.from(String(s ?? ''))
    .map(ch => (ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRAS.includes(ch) ? ch : ''))
    .join('')
    .replace(/[\r\n\t]+/g, ' ');
}

function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
}

// Wrap text to fit maxWidth; returns lines.
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function right(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = DARK) {
  const t = safe(text);
  page.drawText(t, { x: x - font.widthOfTextAtSize(t, size), y, size, font, color });
}

export interface InvoicePdfData {
  invoice_number: string;
  title: string;
  clientName: string;
  items: any[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string;
  issued_date?: string | null;
  notes?: string | null;
  payUrl?: string | null;
}

export async function buildInvoicePdf(inv: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.invoice_number}`);
  doc.setAuthor('Mother Nature Agency');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([612, 792]); // US Letter
  const L = 50, R = 562;
  let y = 740;

  // Header
  page.drawText('Mother Nature Agency', { x: L, y, size: 20, font: bold, color: BLUE });
  right(page, 'INVOICE', R, y, bold, 20, BLUE);
  y -= 18;
  page.drawText('mn@mothernatureagency.com', { x: L, y, size: 10, font, color: GREY });
  right(page, inv.invoice_number, R, y, bold, 11);
  y -= 36;

  // Bill to / dates
  page.drawText('BILL TO', { x: L, y, size: 8, font: bold, color: GREY });
  const meta: [string, string][] = [
    ['Issued', inv.issued_date || '—'],
    ['Due', inv.due_date],
  ];
  y -= 14;
  page.drawText(safe(inv.clientName), { x: L, y, size: 12, font: bold, color: DARK });
  let my = y + 14;
  for (const [k, v] of meta) {
    page.drawText(k, { x: 400, y: my, size: 9, font, color: GREY });
    right(page, v, R, my, bold, 10);
    my -= 16;
  }
  y -= 16;
  for (const l of wrap(inv.title, font, 10, 320)) {
    page.drawText(l, { x: L, y, size: 10, font, color: GREY });
    y -= 13;
  }
  y -= 20;

  // Line items
  const cols = { desc: L + 8, qty: 360, rate: 460, amt: R - 8 };
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 22, color: rgb(0.945, 0.961, 0.976) });
  page.drawText('DESCRIPTION', { x: cols.desc, y, size: 8, font: bold, color: GREY });
  right(page, 'QTY', cols.qty, y, bold, 8, GREY);
  right(page, 'RATE', cols.rate, y, bold, 8, GREY);
  right(page, 'AMOUNT', cols.amt, y, bold, 8, GREY);
  y -= 26;

  const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items || [];
  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.rate ?? item.amount) || 0;
    const lines = wrap(item.description || item.name || '—', font, 10, 280);
    if (y - lines.length * 13 < 180) {
      page = doc.addPage([612, 792]);
      y = 740;
    }
    lines.forEach((l, i) => page.drawText(l, { x: cols.desc, y: y - i * 13, size: 10, font, color: DARK }));
    right(page, String(qty), cols.qty, y, font, 10);
    right(page, money(rate), cols.rate, y, font, 10);
    right(page, money(qty * rate), cols.amt, y, font, 10);
    y -= lines.length * 13 + 6;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: LINE });
    y -= 14;
  }

  // Totals
  y -= 4;
  right(page, 'Subtotal', 460, y, font, 10, GREY);
  right(page, money(inv.subtotal), cols.amt, y, font, 10);
  if (Number(inv.tax_amount) > 0) {
    y -= 16;
    right(page, `Tax (${inv.tax_rate}%)`, 460, y, font, 10, GREY);
    right(page, money(inv.tax_amount), cols.amt, y, font, 10);
  }
  y -= 24;
  right(page, 'Total Due', 460, y, bold, 13, BLUE);
  right(page, money(inv.total), cols.amt, y, bold, 13, BLUE);
  y -= 40;

  // How to pay
  if (y < 150) {
    page = doc.addPage([612, 792]);
    y = 740;
  }
  page.drawText('HOW TO PAY', { x: L, y, size: 8, font: bold, color: GREY });
  y -= 16;
  const pay: string[] = [];
  if (inv.payUrl) pay.push(`Online (bank transfer or card): ${inv.payUrl}`);
  pay.push('Zelle: mn@mothernatureagency.com');
  pay.push('Check payable to: Mother Nature Agency LLC');
  for (const p of pay) {
    for (const l of wrap(p, font, 9, R - L)) {
      page.drawText(l, { x: L, y, size: 9, font, color: DARK });
      y -= 13;
    }
  }

  if (inv.notes) {
    y -= 12;
    page.drawText('NOTES', { x: L, y, size: 8, font: bold, color: GREY });
    y -= 14;
    for (const l of wrap(inv.notes, font, 9, R - L)) {
      if (y < 50) break;
      page.drawText(l, { x: L, y, size: 9, font, color: DARK });
      y -= 13;
    }
  }

  return doc.save();
}
