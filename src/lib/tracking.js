// Eventos para Google Tag Manager (GTM-54S2SQSP). GTM no ve lo que pasa
// dentro de React/Firebase (registro, método de pago, pago guardado), así
// que se empujan al dataLayer desde el código. Los nombres de eventos y
// campos siguen el estándar de GA4 -- no cambiarlos sin tocar GTM.
export function track(event, params = {}) {
  window.dataLayer = window.dataLayer || [];
  // GA4 recomienda limpiar el objeto ecommerce anterior antes de uno nuevo.
  if (params.ecommerce) window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ...params });
}

export function courseItem(course, price) {
  return {
    item_id: String(course.id),
    item_name: course.title,
    item_category: 'taller',
    price: Number(price ?? course.price ?? 0),
    quantity: 1,
  };
}
