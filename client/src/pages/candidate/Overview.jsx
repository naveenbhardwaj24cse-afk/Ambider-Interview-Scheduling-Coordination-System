import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import Button from '../../components/Button';
import CandidateStepperTimeline from '../../components/CandidateStepperTimeline';
import Modal from '../../components/Modal';

const CandidateOverview = () => {
  const { bookings, positions, token, fetchPositionsAndBookings, setError } = useOutletContext();
  const navigate = useNavigate();
  
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRespondingOffer, setIsRespondingOffer] = useState(false);

  const withdrawApplication = async (id) => {
    if (!window.confirm('Are you sure you want to withdraw your application? This action cannot be undone.')) return;
    setIsWithdrawing(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/candidate/bookings/${id}/withdraw`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to withdraw application');
      alert('Application withdrawn successfully');
      fetchPositionsAndBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const acceptOffer = async (id) => {
    if (!window.confirm('Are you sure you want to accept this offer?')) return;
    setIsRespondingOffer(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/candidate/bookings/${id}/accept-offer`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept offer');
      alert('Offer accepted! Congratulations.');
      fetchPositionsAndBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRespondingOffer(false);
    }
  };

  const declineOffer = async (id) => {
    if (!window.confirm('Are you sure you want to decline this offer? This action is permanent.')) return;
    setIsRespondingOffer(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/candidate/bookings/${id}/decline-offer`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to decline offer');
      alert('Offer declined.');
      fetchPositionsAndBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRespondingOffer(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>My Applications</h2>
      {bookings.length === 0 ? (
        <Card>
          <p style={{ color: 'var(--text-muted)' }}>No applications yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {bookings.map(b => {
            const companyName = positions.find(p => p._id === b.positionId?._id)?.companyName;
            return (
              <Card key={b._id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                      {b.positionId?.title} 
                      {companyName && <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}> at {companyName}</span>}
                    </h3>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <div><strong>Recruiter:</strong> {b.recruiterId?.name || 'Unassigned'}</div>
                      {b.slotStart && <div><strong>Interview Time:</strong> {new Date(b.slotStart).toLocaleString()}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {b.status === 'selected' && (
                      <>
                        <Button style={{ background: '#059669' }} onClick={() => acceptOffer(b._id)} disabled={isRespondingOffer}>
                          Accept Offer
                        </Button>
                        <Button style={{ background: '#ef4444' }} onClick={() => declineOffer(b._id)} disabled={isRespondingOffer}>
                          Decline Offer
                        </Button>
                      </>
                    )}
                    {b.status === 'pending_next_round' && (
                      <Button style={{ background: '#f59e0b' }} onClick={() => navigate(`/candidate/positions?booking=${b._id}&pos=${b.positionId?._id}`)}>
                        Book Round {b.currentRound + 1}
                      </Button>
                    )}
                    {b.status === 'confirmed' && !b.slotStart && (
                      <Button style={{ background: '#059669' }} onClick={() => navigate(`/candidate/positions?booking=${b._id}&pos=${b.positionId?._id}`)}>
                        Book Slot
                      </Button>
                    )}
                    {b.status === 'confirmed' && b.meetLink && (
                      <a href={b.meetLink} target="_blank" rel="noreferrer" style={{ background: '#f97316', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center' }}>
                        Join Meet
                      </a>
                    )}
                    {(b.status === 'applied' || b.status === 'confirmed' || b.status === 'pending_next_round') && (
                      <Button variant="outline" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => withdrawApplication(b._id)} disabled={isWithdrawing}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
                <CandidateStepperTimeline booking={b} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CandidateOverview;
