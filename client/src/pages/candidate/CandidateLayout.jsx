import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

const CandidateLayout = () => {
  const [positions, setPositions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState({});
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const fetchPositionsAndBookings = async () => {
    try {
      const [posRes, bookRes, profRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/candidate/positions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/candidate/bookings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/candidate/profile`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (posRes.ok) setPositions(await posRes.json());
      if (bookRes.ok) setBookings(await bookRes.json());
      if (profRes.ok) setProfile(await profRes.json());
    } catch (e) {
      console.error(e);
      setError('Failed to fetch data');
    }
  };

  useEffect(() => { fetchPositionsAndBookings(); }, []);

  const context = {
    positions, bookings, profile, token, fetchPositionsAndBookings, error, setError
  };

  return (
    <div className="dashboard-container fade-in" style={{ padding: '2rem' }}>
      <h1>Candidate Portal</h1>
      {error && <div style={{ color: 'var(--danger-color)', margin: '1rem 0' }}>{error}</div>}
      <Outlet context={context} />
    </div>
  );
};

export default CandidateLayout;
