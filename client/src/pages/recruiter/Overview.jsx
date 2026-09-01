import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../../components/Button';

const RecruiterOverview = () => {
  const { positions, bookings, hiringRequests, token } = useOutletContext();
  const userId = JSON.parse(atob(token.split('.')[1])).id;

  const openPositions = positions.filter(p => p.isActive).length;
  const pendingShortlist = bookings.filter(b => b.status === 'applied' && b.recruiterId === userId).length;
  const assignedRequests = hiringRequests.length;

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [cvFile, setCvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const data = new FormData();
    data.append('name', formData.name);
    data.append('email', formData.email);
    data.append('password', formData.password);
    if (cvFile) {
      data.append('cv', cvFile);
    }
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/recruiter/candidates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ name: '', email: '', password: '' });
        setCvFile(null);
        alert('Candidate added successfully!');
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to add candidate');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <Button onClick={() => setShowModal(true)}>+ Add Candidate</Button>
      </div>
      <div className="stats-row" style={{ marginTop: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'var(--primary-color)', borderLeftWidth: '4px', borderLeftStyle: 'solid' }}>
          <h3>Recruitment Stats</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
              <strong>{openPositions}</strong> Open Positions
            </div>
            <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
              <strong>{pendingShortlist}</strong> Candidates Awaiting Shortlist
            </div>
            <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
              <strong>{assignedRequests}</strong> Assigned Hiring Requests
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add New Candidate</h2>
            {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div>
                <label>Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div>
                <label>Password</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} />
              </div>
              <div>
                <label>CV (Optional, PDF/DOC)</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files[0])} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Candidate'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterOverview;
