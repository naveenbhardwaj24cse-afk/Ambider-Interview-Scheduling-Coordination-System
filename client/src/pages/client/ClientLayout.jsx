import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

const ClientLayout = () => {
  const [requests, setRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client/hiring-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error(e);
      setError('Failed to fetch requests');
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client/bookings/pending-approval`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setPendingApprovals(await res.json());
    } catch (e) {
      console.error(e);
      setError('Failed to fetch pending approvals');
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchPendingApprovals();
  }, []);

  const context = {
    requests, pendingApprovals, token, fetchRequests, fetchPendingApprovals, error, setError
  };

  return (
    <div className="dashboard-container fade-in" style={{ padding: '2rem' }}>
      <h1>Client Portal (Company)</h1>
      {error && <div style={{ color: 'var(--danger-color)', margin: '1rem 0' }}>{error}</div>}
      <Outlet context={context} />
    </div>
  );
};

export default ClientLayout;
