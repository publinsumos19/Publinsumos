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

// Prints a standalone HTML document without leaving the app.
export function printHtml(html) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open();
  f.contentDocument.write(html);
  f.contentDocument.close();
  setTimeout(() => {
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => f.remove(), 1000);
  }, 300);
}

export const csvFrom = (rows) => {
  const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  return '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n');
};
