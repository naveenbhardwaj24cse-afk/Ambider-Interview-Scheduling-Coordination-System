import React from 'react';
import { useOutletContext } from 'react-router-dom';

const HROverview = () => {
  const { alerts } = useOutletContext();

  return (
    <div>
      <div className="stats-row" style={{ marginTop: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'var(--danger-color)', borderLeftWidth: '4px', borderLeftStyle: 'solid' }}>
          <h3>Needs Attention</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
              <strong style={{ color: 'var(--danger-color)' }}>{alerts.pendingRequests.length}</strong> Pending Hiring Requests
            </div>
            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
              <strong style={{ color: 'var(--danger-color)' }}>{alerts.staleBookings.length}</strong> Stale Bookings (&gt; 5 days)
            </div>
            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
              <strong style={{ color: 'var(--danger-color)' }}>{alerts.overduePositions.length}</strong> Overdue Positions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HROverview;
