// Texto de un PDF (el sílabo que sube el admin, A8), para que el Asistente IA
// pueda responder con él. pdf.js se carga solo cuando se usa.
export const extractPdfText = async (file, maxChars = 40000) => {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/build/pdf.min.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages && text.length < maxChars; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += `${content.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim()}\n`;
  }
  return { text: text.slice(0, maxChars), pages: pdf.numPages };
};
