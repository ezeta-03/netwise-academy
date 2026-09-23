// Fuente única de "qué módulos son entregables" y "cuánto pesa cada uno" --
// antes cada página lo calculaba a su manera (Registro de notas usaba pesos
// iguales cuando faltaban, el Cronograma mostraba "—", la Rúbrica "Peso no
// definido") y una misma nota podía verse con pesos distintos según la vista.

const round2 = (n) => Math.round(n * 100) / 100;

// Solo los módulos con un entregable definido cuentan para notas y pesos.
export const deliverableModules = (modules) => (modules || []).filter((m) => m.deliverable?.description);

export const equalWeight = (count) => (count > 0 ? round2(100 / count) : 0);

// Devuelve una fila por entregable con su peso efectivo: el definido por el
// docente o, si ninguno lo definió, el reparto en partes iguales (mismo
// criterio que el Registro de notas). `explicit` distingue los dos casos y
// `sumsTo100` avisa cuando los pesos no cierran el 100%.
export const resolveWeights = (modules) => {
  const list = deliverableModules(modules);
  const hasWeight = (m) => m.deliverable?.weight != null && m.deliverable.weight !== '' && Number.isFinite(Number(m.deliverable.weight));
  const explicitTotal = list.filter(hasWeight).reduce((sum, m) => sum + Number(m.deliverable.weight), 0);
  const missing = list.filter((m) => !hasWeight(m)).length;
  // Sin ningún peso definido: partes iguales. Con pesos parciales: los que
  // faltan se reparten lo que resta hasta 100 (nunca un 100/N extra que
  // haga pasar el total de 100%).
  const fallback = missing === list.length ? equalWeight(list.length) : (missing ? round2(Math.max(0, 100 - explicitTotal) / missing) : 0);
  const rows = list.map((module, index) => {
    const explicit = hasWeight(module);
    return { module, index, explicit, weight: explicit ? Number(module.deliverable.weight) : fallback };
  });
  const total = round2(rows.reduce((sum, r) => sum + (Number.isFinite(r.weight) ? r.weight : 0), 0));
  return {
    rows,
    total,
    allExplicit: rows.length > 0 && rows.every((r) => r.explicit),
    anyExplicit: rows.some((r) => r.explicit),
    sumsTo100: Math.abs(total - 100) <= 0.05,
  };
};

// "Trabajo final" para el último entregable, "Entregable M{n}" para el resto
// (n cuenta solo entregables, no todos los módulos).
export const deliverableLabel = (index, count) => (index === count - 1 ? 'Trabajo final' : `Entregable M${index + 1}`);
