import React from 'react';
import './components.css';

export default function Input({ label, type = 'text', ...props }) {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input type={type} className="input-field" {...props} />
    </div>
  );
}
