import React from 'react';
import './components.css';

export default function Card({ children, className = '' }) {
  return (
    <div className={`glass-panel card ${className}`}>
      {children}
    </div>
  );
}
