import React from 'react';

// Interruptor encendido/apagado (C2 "Pasa a registro").
const Switch = ({ checked, onChange, label, disabled = false }) => (
  <button
    type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled}
    className={`nw-switch ${checked ? 'is-on' : ''}`}
    onClick={() => onChange(!checked)}
  >
    <span className="nw-switch-knob" />
  </button>
);

export default Switch;
