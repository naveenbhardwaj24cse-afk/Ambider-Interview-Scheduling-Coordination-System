import React, { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [role, setRole] = useState('interviewer');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      setIsAuthenticated(false);
    } else {
      const user = JSON.parse(userStr);
      setRole(user.role);
    }
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="layout">
      <Sidebar role={role} />
      <div className="main-content">
        <Outlet context={{ role }} />
      </div>
    </div>
  );
};

export default Layout;
