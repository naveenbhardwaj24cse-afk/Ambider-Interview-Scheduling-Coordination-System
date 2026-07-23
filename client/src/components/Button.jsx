import React from 'react';
import './components.css'; 

export default function Button({ children, onClick, type = 'button', className = '', ...props }) {
  return (
    <button 
      type={type} 
      className={`btn-primary ${className}`} 
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
