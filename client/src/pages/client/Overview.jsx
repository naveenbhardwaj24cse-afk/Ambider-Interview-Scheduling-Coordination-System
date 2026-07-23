import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import Button from '../../components/Button';

const ClientOverview = () => {
  const { pendingApprovals, token, fetchPendingApprovals, fetchRequests } = useOutletContext();
  const navigate = useNavigate();

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this selection and extend an official job offer?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client/bookings/${id}/approve-selection`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Offer extended to candidate successfully.');
        fetchPendingApprovals();
        fetchRequests();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to approve selection');
      }
    } catch (err) {
      console.error(err);
      alert('Error approving selection');
    }
  };

  const handleReject = async (id) => {
    const notes = window.prompt('Enter feedback/reason for rejection (optional):');
    if (notes === null) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client/bookings/${id}/reject-selection`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ notes })
      });
      if (res.ok) {
        alert('Candidate selection rejected.');
        fetchPendingApprovals();
        fetchRequests();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to reject selection');
      }
    } catch (err) {
      console.error(err);
      alert('Error rejecting selection');
    }
  };

  return (
    <div>
      <div className="stats-row" style={{ marginTop: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'var(--primary-color)', borderLeftWidth: '4px', borderLeftStyle: 'solid' }}>
          <h3>Overview</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
              <strong>{pendingApprovals.length}</strong> Candidates Awaiting Your Sign-off
            </div>
            <Button variant="outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/client/requests')}>
              View My Hiring Requests
            </Button>
          </div>
        </div>
      </div>

      {pendingApprovals.length > 0 && (
        <Card style={{ marginTop: '2rem', borderColor: 'var(--primary-color)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Awaiting Your Sign-off (Candidate Selected)
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            The following candidates have successfully cleared all interview rounds. Please review their selections and approve to extend the official offer.
          </p>
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Candidate Email</th>
                <th>Position</th>
                <th>Recruiter</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingApprovals.map(b => (
                <tr key={b._id}>
                  <td><strong>{b.candidateName}</strong></td>
                  <td>{b.candidateEmail}</td>
                  <td>{b.positionId?.title}</td>
                  <td>{b.recruiterId?.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button onClick={() => handleApprove(b._id)} style={{ background: '#10b981' }}>
                        Approve & Extend Offer
                      </Button>
                      <Button onClick={() => handleReject(b._id)} style={{ background: '#ef4444' }}>
                        Reject Candidate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export default ClientOverview;
