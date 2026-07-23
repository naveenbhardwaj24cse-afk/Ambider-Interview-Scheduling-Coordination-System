import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';

const RecruiterPipeline = () => {
  const { positions, bookings } = useOutletContext();
  const [comparisonPositionId, setComparisonPositionId] = useState('');

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>Candidate Comparison</h2>
      <Card>
        <div style={{ marginBottom: '1rem' }}>
          <label className="input-label">Select Position</label>
          <select 
            className="input-field" 
            value={comparisonPositionId} 
            onChange={e => setComparisonPositionId(e.target.value)}
          >
            <option value="">-- Choose a Position --</option>
            {positions.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
          {comparisonPositionId && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '4px', marginTop: '0.5rem' }}>
              <div className="field-group">
                <span className="field-label">Company: </span>
                <span className="field-value">{positions.find(p => p._id === comparisonPositionId)?.companyName || 'N/A'}</span>
              </div>
              <div className="field-group">
                <span className="field-label">Position: </span>
                <span className="field-value">{positions.find(p => p._id === comparisonPositionId)?.title || 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
        
        {comparisonPositionId ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {bookings.filter(b => b.positionId?._id === comparisonPositionId).length === 0 ? (
              <p>No candidates for this position yet.</p>
            ) : (
              bookings
                .filter(b => b.positionId?._id === comparisonPositionId)
                .sort((a, b) => b.roundsCleared - a.roundsCleared)
                .map(b => (
                  <Card key={b._id} style={{ border: '1px solid var(--border-color)', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{b.candidateName}</h4>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1rem' }}>{b.candidateEmail}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Status:</span>
                      <StatusBadge status={b.status} type="booking" />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Round:</span>
                      <span>{b.currentRound} / {b.totalRounds}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Cleared:</span>
                      <span>{b.roundsCleared}</span>
                    </div>
                  </Card>
              ))
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Select a position above to compare candidates.</p>
        )}
      </Card>
    </div>
  );
};

export default RecruiterPipeline;
