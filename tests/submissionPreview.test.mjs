// Tests de src/lib/submissionPreview.js: qué muestra el visor del docente
// según lo que presentó el alumno.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { describeSubmission, drivePreviewUrl } from '../src/lib/submissionPreview.js';

const FILE = 'https://firebasestorage.googleapis.com/v0/b/x/o/submissions%2Fuid%2F1_m1_170_plan.pdf?alt=media&token=t';

describe('describeSubmission', () => {
  test('PDF adjunto -> visor de PDF', () => {
    const info = describeSubmission({ fileUrl: FILE, fileName: 'Plan de contenidos.PDF' });
    assert.equal(info.kind, 'pdf');
    assert.equal(info.src, FILE);
    assert.equal(info.name, 'Plan de contenidos.PDF');
  });
  test('imagen adjunta -> se muestra la imagen', () => {
    for (const name of ['captura.png', 'foto.JPG', 'foto.jpeg', 'pieza.webp']) {
      assert.equal(describeSubmission({ fileUrl: FILE, fileName: name }).kind, 'image');
    }
  });
  test('Word, PowerPoint, Excel o ZIP -> sin vista previa, se descarga', () => {
    for (const name of ['informe.docx', 'deck.pptx', 'datos.xlsx', 'todo.zip', 'viejo.doc']) {
      assert.equal(describeSubmission({ fileUrl: FILE, fileName: name }).kind, 'file');
    }
  });
  test('sin nombre guardado, usa el de la URL', () => {
    const info = describeSubmission({ fileUrl: FILE });
    assert.equal(info.kind, 'pdf');
    assert.match(info.name, /plan\.pdf$/);
  });
  test('el archivo manda sobre la nota', () => {
    assert.equal(describeSubmission({ fileUrl: FILE, fileName: 'a.pdf', note: 'https://example.com' }).kind, 'pdf');
  });
  test('link de Drive o Docs -> vista previa incrustada, conservando el link original', () => {
    const info = describeSubmission({ note: ' https://drive.google.com/file/d/ABC_123-x/view?usp=sharing ' });
    assert.equal(info.kind, 'embed');
    assert.equal(info.src, 'https://drive.google.com/file/d/ABC_123-x/preview');
    assert.equal(info.link, 'https://drive.google.com/file/d/ABC_123-x/view?usp=sharing');
  });
  test('otro link -> botón para abrirlo', () => {
    const info = describeSubmission({ note: 'https://www.canva.com/design/XYZ/view' });
    assert.equal(info.kind, 'link');
    assert.equal(info.link, 'https://www.canva.com/design/XYZ/view');
  });
  test('texto libre -> se muestra el texto', () => {
    assert.deepEqual(describeSubmission({ note: 'Adjunté todo en el grupo.' }), { kind: 'text', text: 'Adjunté todo en el grupo.', name: 'Entrega escrita' });
  });
  test('sin entrega o vacía', () => {
    for (const sub of [null, undefined, {}, { note: '   ' }]) assert.equal(describeSubmission(sub).kind, 'empty');
  });
  test('una URL peligrosa nunca llega al visor', () => {
    assert.equal(describeSubmission({ fileUrl: 'javascript:alert(1)', fileName: 'x.pdf' }).kind, 'empty');
    assert.equal(describeSubmission({ note: 'javascript:alert(1)' }).kind, 'text');
  });
});

describe('drivePreviewUrl', () => {
  test('documentos, presentaciones y hojas de Google', () => {
    assert.equal(drivePreviewUrl('https://docs.google.com/document/d/DOC1/edit'), 'https://docs.google.com/document/d/DOC1/preview');
    assert.equal(drivePreviewUrl('https://docs.google.com/presentation/d/P1/edit#slide=1'), 'https://docs.google.com/presentation/d/P1/preview');
    assert.equal(drivePreviewUrl('https://docs.google.com/spreadsheets/d/S1/'), 'https://docs.google.com/spreadsheets/d/S1/preview');
  });
  test('lo que no es Drive/Docs -> null', () => {
    for (const url of ['https://example.com/a.pdf', 'http://drive.google.com/file/d/X/view', 'https://drive.google.com/drive/folders/X', '', null]) {
      assert.equal(drivePreviewUrl(url), null);
    }
  });
});
