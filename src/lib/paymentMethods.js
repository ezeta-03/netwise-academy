import { CreditCard, Smartphone, Landmark } from 'lucide-react';

// Metadata compartida entre el checkout (src/pages/Checkout.jsx) y el
// centro de mando del admin (src/pages/admin/AdminPagos.jsx) -- un solo
// lugar para agregar un método de pago nuevo o cambiar su copy. Los
// métodos "manual" (todo menos "card") no tienen pasarela real: el
// comprador paga afuera con el número/nombre que puso el admin y el
// equipo confirma; "verb" arma el mensaje exacto que ve el comprador.
export const PAYMENT_METHODS = [
  {
    id: 'yape',
    label: 'Yape Empresas / Plin Negocios',
    icon: Smartphone,
    manual: true,
    verb: 'Yapea o plinea',
    numberLabel: 'Número de Yape/Plin',
    numberPlaceholder: 'Ej. 987 654 321',
    notePlaceholder: 'Ej. Solo pagos desde el mismo titular.',
  },
  {
    id: 'card',
    label: 'Tarjeta de crédito/débito',
    icon: CreditCard,
    manual: false,
  },
  {
    id: 'transfer',
    label: 'Transferencia bancaria',
    icon: Landmark,
    manual: true,
    verb: 'Transfiere',
    numberLabel: 'Número de cuenta / CCI',
    numberPlaceholder: 'Ej. 191-1234567-0-89',
    notePlaceholder: 'Ej. BCP - Cuenta corriente en soles.',
  },
];

// Arma el mensaje que ve el comprador para un método manual, con el monto
// exacto de su compra -- si el método es solo-QR (cfg.noNumber, ver
// AdminPagos), no hay número que mostrar y el QR ya se ve aparte (ver
// checkout-yape-qr en Checkout.jsx); si el admin todavía no configuró nada,
// cae a un mensaje genérico en vez de mostrar "al ...".
export const buildPaymentInstructions = (methodId, cfg, amountLabel) => {
  const meta = PAYMENT_METHODS.find((m) => m.id === methodId);
  if (!meta?.manual) return 'Nuestro equipo te contactará para completar tu pago.';

  const who = cfg?.accountName?.trim() ? ` (${cfg.accountName.trim()})` : '';
  const note = cfg?.note?.trim() ? ` ${cfg.note.trim()}` : '';

  if (cfg?.noNumber) {
    return `${meta.verb} ${amountLabel} escaneando el código QR${who} y envía tu comprobante para confirmar tu cupo.${note}`;
  }
  if (!cfg?.number?.trim()) return 'Nuestro equipo te contactará para completar tu pago.';
  return `${meta.verb} ${amountLabel} al ${cfg.number.trim()}${who} y envía tu comprobante para confirmar tu cupo.${note}`;
};
