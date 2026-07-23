import React from 'react';
import { useOutletContext } from 'react-router-dom';

const RecruiterOverview = () => {
  const { positions, bookings, hiringRequests, token } = useOutletContext();
  const userId = JSON.parse(atob(token.split('.')[1])).id;

  const openPositions = positions.filter(p => p.isActive).length;
  const pendingShortlist = bookings.filter(b => b.status === 'applied' && b.recruiterId === userId).length;
  const assignedRequests = hiringRequests.length;

  return (
    <div>
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
    </div>
  );
};

export default RecruiterOverview;
