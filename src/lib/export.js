// Download and print helpers. Inside the claude.ai viewer (the demo link) files go through its
// downloads capability and the print dialog is not available; everywhere else the browser does both.
const viewer = () => (typeof window !== 'undefined' && window.claude?.use ? window.claude : null);

export const canPrint = () => !viewer();

export async function saveFile(filename, data, type = 'text/plain;charset=utf-8') {
  const v = viewer();
  if (v) {
    const downloads = await v.use('downloads');
    if (!downloads) throw new Error('Este visor no permite descargar archivos.');
    try {
      await downloads.save({ filename, data });
      return true;
    } catch (e) {
      if (e?.code === 'declined') return false;
      throw new Error(e?.message || 'No se pudo descargar el archivo.');
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

// Turns a standalone HTML document into an A4 PDF and downloads it with that name.
export async function savePdf(filename, html) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0';
  document.body.appendChild(f);
  try {
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    await new Promise((r) => setTimeout(r, 150));
    await Promise.all([...f.contentDocument.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));
    const body = f.contentDocument.body;
    const canvas = await html2canvas(body, { scale: 2, backgroundColor: '#ffffff', windowWidth: 794, width: 794, height: body.scrollHeight });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const w = 210, h = (canvas.height * w) / canvas.width, pag = 297;
    const img = canvas.toDataURL('image/jpeg', 0.92);
    for (let y = 0; y < h; y += pag) { if (y) pdf.addPage(); pdf.addImage(img, 'JPEG', 0, -y, w, h); }
    return await saveFile(filename.endsWith('.pdf') ? filename : filename + '.pdf', pdf.output('blob'), 'application/pdf');
  } finally { f.remove(); }
}

// Prints a standalone HTML document without leaving the app.
// While the print window is open the page title is the document's, so "Save as PDF" suggests that name.
export function printHtml(html) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open();
  f.contentDocument.write(html);
  f.contentDocument.close();
  const antes = document.title;
  const titulo = f.contentDocument.title;
  setTimeout(() => {
    if (titulo) document.title = titulo;
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => { f.remove(); document.title = antes; }, 1000);
  }, 300);
}

export const csvFrom = (rows) => {
  const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  return '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n');
};
