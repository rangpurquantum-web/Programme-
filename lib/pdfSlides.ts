export type PdfSlide = { title: string; text: string; image: string; show?: number };

// One image slide per page of a PDF stored in Cloudinary.
export function pdfSlides(url: string, pages: number, name: string, show = 0): PdfSlide[] {
  const n = Math.min(100, Math.max(1, pages || 1));
  const base = name.replace(/\.[^.]+$/, '') || 'Slide';
  const out: PdfSlide[] = [];
  for (let i = 1; i <= n; i++) {
    const image = url.replace('/upload/', `/upload/pg_${i},w_1600,q_auto/`).replace(/\.pdf$/i, '.jpg');
    out.push({ title: `${base} ${i}`, text: '', image, ...(show > 0 ? { show } : {}) });
  }
  return out;
}
