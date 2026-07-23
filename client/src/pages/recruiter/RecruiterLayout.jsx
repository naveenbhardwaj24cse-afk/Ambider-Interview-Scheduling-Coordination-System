import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

const format12Hour = (timeStr) => {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  if (!hourStr || !minStr) return '';
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minStr} ${ampm}`;
};

const RecruiterLayout = () => {
  const [positions, setPositions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [hiringRequests, setHiringRequests] = useState([]);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const fetchData = async () => {
    try {
      const [posRes, bookRes, hrRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/recruiter/positions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/recruiter/bookings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/recruiter/hiring-requests`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (posRes.ok) setPositions(await posRes.json());
      if (bookRes.ok) setBookings(await bookRes.json());
      if (hrRes.ok) setHiringRequests(await hrRes.json());
    } catch (e) {
      console.error(e);
      setError('Failed to fetch data');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const context = {
    positions, bookings, hiringRequests, token, fetchData, error, setError, format12Hour
  };

  return (
    <div className="dashboard-container fade-in" style={{ padding: '2rem' }}>
      <h1>Recruiter Dashboard</h1>
      {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}
      <Outlet context={context} />
    </div>
  );
};

export default RecruiterLayout;
