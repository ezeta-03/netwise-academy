import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getApprovalPolicy, resolveApprovalPolicy } from '../src/lib/approvalPolicy.js';
import { APPROVAL } from '../src/lib/approval.js';

describe('approvalPolicy', () => {
  test('Redes (1) y Branding (2) tienen política; el texto sale de APPROVAL', () => {
    for (const id of [1, '2']) {
      const p = getApprovalPolicy(id);
      assert.ok(p.syllabusBadge);
      assert.match(p.approval.requirements[0], /80%/);
      assert.match(p.approval.requirements[1], /16 \(dieciséis\)/);
      assert.match(p.approval.options[0].text, /16 \(dieciséis\)/);
      assert.match(p.approval.options[1].text, /75%/);
      assert.match(p.accreditations[0].requirement, /≥ 16 \(vía regular\).*≥ 16 en la evaluación sustitutoria/);
      assert.match(p.accreditations[1].requirement, /75%/);
    }
    assert.equal(getApprovalPolicy(1).syllabusBadge, 'Según sílabo EDRRSS');
    assert.equal(APPROVAL.minFinalGrade, 16);
  });
  test('sin política estándar: null; ids heredados de Object.prototype no cuentan', () => {
    assert.equal(getApprovalPolicy(3), null);
    assert.equal(getApprovalPolicy('constructor'), null);
    assert.equal(getApprovalPolicy(undefined), null);
  });
  test('resolveApprovalPolicy: la política estándar pisa requisitos guardados pero conserva weightsNote', () => {
    const stored = { weightsNote: 'nota', approval: { requirements: ['15 (quince)'] }, accreditations: [] };
    const r = resolveApprovalPolicy(2, stored);
    assert.equal(r.weightsNote, 'nota');
    assert.match(r.approval.requirements[1], /16/);
    assert.equal(r.accreditations.length, 2);
    assert.equal(resolveApprovalPolicy(3, stored), stored);
    assert.equal(resolveApprovalPolicy(3, undefined), null);
  });
});
