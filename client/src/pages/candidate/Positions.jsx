import React, { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import Card from '../../components/Card';
import Button from '../../components/Button';

const CandidatePositions = () => {
  const { positions, bookings, token, fetchPositionsAndBookings, setError } = useOutletContext();
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [slots, setSlots] = useState([]);
  const [overlapError, setOverlapError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  
  const bookingRoundFor = searchParams.get('booking');
  const posIdParam = searchParams.get('pos');

  useEffect(() => {
    if (posIdParam) {
      const pos = positions.find(p => p._id === posIdParam);
      if (pos) {
        openBookingModal(pos);
      }
    }
  }, [posIdParam, positions]);

  const openBookingModal = async (position) => {
    setSelectedPosition(position);
    setOverlapError(null);
    try {
      const res = await fetch(`http://localhost:5000/api/candidate/positions/${position._id}/slots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setSlots(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const applyPosition = async (position) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/candidate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ positionId: position._id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply');
      
      alert('Applied successfully! Awaiting shortlist.');
      fetchPositionsAndBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const bookSlot = async (slot) => {
    setIsLoading(true);
    setError('');
    setOverlapError(null);
    try {
      const startObj = new Date(slot.specificDate);
      const [sh, sm] = slot.startTime.split(':');
      startObj.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);

      const endObj = new Date(slot.specificDate);
      const [eh, em] = slot.endTime.split(':');
      endObj.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);

      const res = await fetch('http://localhost:5000/api/candidate/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          positionId: selectedPosition._id, 
          slotStart: startObj.toISOString(), 
          slotEnd: endObj.toISOString(),
          availabilityId: slot._id,
          existingBookingId: bookingRoundFor
        })
      });
      const data = await res.json();
      
      if (res.status === 409 && data.conflictingSlotStart) {
        setOverlapError(data.error);
        setIsLoading(false);
        return;
      }
      
      if (!res.ok) throw new Error(data.error || 'Failed to book slot');
      
      alert(bookingRoundFor ? 'Next round booked successfully!' : 'Interview booked successfully!');
      setSelectedPosition(null);
      fetchPositionsAndBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem' }}>
      <div style={{ flex: 1 }}>
        <h2>Open Positions</h2>
        <Card>
          {positions.length === 0 && <p>No open positions right now.</p>}
          {positions.map(p => (
            <div key={p._id} style={{ padding: '1rem 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0' }}>{p.title} at {p.companyName}</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Skills: {p.skillsRequired.join(', ')}</p>
              </div>
              {bookings.some(b => b.positionId?._id === p._id && !['cancelled', 'rejected', 'withdrawn'].includes(b.status)) ? (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Applied</span>
              ) : (
                <Button onClick={() => applyPosition(p)} disabled={isLoading}>Apply</Button>
              )}
            </div>
          ))}
        </Card>
      </div>

      {selectedPosition && (
        <div style={{ flex: 1 }}>
          <h2>Available Slots for {selectedPosition.title}</h2>
          <Card>
            {overlapError && (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', border: '1px solid #f87171' }}>
                <strong>Booking Conflict</strong><br/>
                {overlapError}
              </div>
            )}
            {slots.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No slots available right now.</p> : slots.map(s => (
              <div key={s._id} style={{ padding: '1rem 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{new Date(s.specificDate).toLocaleDateString()}</strong><br />
                  <span style={{ fontSize: '0.85rem' }}>{s.startTime} - {s.endTime}</span>
                </div>
                <Button variant="primary" onClick={() => bookSlot(s)} disabled={isLoading}>Book</Button>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
};

export default CandidatePositions;
