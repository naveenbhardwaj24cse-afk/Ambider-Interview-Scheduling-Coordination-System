import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

const HRLayout = () => {
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [hiringRequests, setHiringRequests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [alerts, setAlerts] = useState({ pendingRequests: [], staleBookings: [], overduePositions: [] });

  const token = localStorage.getItem('token');

  const fetchData = async () => {
    try {
      const [uRes, bRes, lRes, hRes, aRes, sRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/admin/bookings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/admin/notifications', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/admin/hiring-requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/admin/dashboard-alerts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/admin/staff', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (bRes.ok) setBookings(await bRes.json());
      if (lRes.ok) setLogs(await lRes.json());
      if (hRes.ok) setHiringRequests(await hRes.json());
      if (aRes.ok) setAlerts(await aRes.json());
      if (sRes.ok) setStaff(await sRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const context = {
    users, bookings, logs, hiringRequests, staff, alerts, token, fetchData
  };

  return (
    <div className="dashboard-container fade-in" style={{ padding: '2rem' }}>
      <h1>HR Admin Dashboard</h1>
      <Outlet context={context} />
    </div>
  );
};

export default HRLayout;
