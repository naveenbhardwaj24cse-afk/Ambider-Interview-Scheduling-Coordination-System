import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';

const RecruiterPositions = () => {
  const { positions, token, format12Hour, setError } = useOutletContext();
  const [positionId, setPositionId] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createAvailability = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/recruiter/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ positionId, specificDate, startTime, endTime })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add availability');
      alert('Availability added');
      setSpecificDate(''); setStartTime(''); setEndTime('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <Card style={{ maxWidth: '600px' }}>
        <h3>Add Availability Slot</h3>
        <form onSubmit={createAvailability} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Position</label>
            <select className="input-field" value={positionId} onChange={e => setPositionId(e.target.value)} required>
              <option value="">Select Position...</option>
              {positions.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
            </select>
            {positionId && (
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '4px', marginTop: '0.5rem' }}>
                <div className="field-group">
                  <span className="field-label">Company: </span>
                  <span className="field-value">{positions.find(p => p._id === positionId)?.companyName || 'N/A'}</span>
                </div>
                <div className="field-group">
                  <span className="field-label">Position: </span>
                  <span className="field-value">{positions.find(p => p._id === positionId)?.title || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <Input type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Start Time {startTime && <span style={{ color: 'var(--primary-color)', marginLeft: '5px' }}>({format12Hour(startTime)})</span>}</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">End Time {endTime && <span style={{ color: 'var(--primary-color)', marginLeft: '5px' }}>({format12Hour(endTime)})</span>}</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" disabled={isLoading}>Add Slot</Button>
        </form>
      </Card>
    </div>
  );
};

export default RecruiterPositions;
