import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const RecruiterBookings = () => {
  const { bookings, token, fetchData } = useOutletContext();
  const userId = JSON.parse(atob(token.split('.')[1])).id;
  
  const [evalModal, setEvalModal] = useState({ isOpen: false, booking: null });
  const [evalNotes, setEvalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const shortlistCandidate = async (id) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/recruiter/bookings/${id}/shortlist`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
      else alert((await res.json()).error || 'Failed to shortlist');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const rejectAppliedCandidate = async (id) => {
    if (!window.confirm('Are you sure you want to reject this applicant?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/recruiter/bookings/${id}/reject-applied`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
      else alert((await res.json()).error || 'Failed to reject');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBooking = async (id) => {
    setIsCancelling(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/recruiter/bookings/${id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCancelling(false);
    }
  };

  const withdrawBooking = async (id) => {
    if (!window.confirm('Are you sure you want to withdraw this candidate? This is a permanent action.')) return;
    setIsWithdrawing(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/recruiter/bookings/${id}/withdraw`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const submitOutcome = async (outcome) => {
    if (!evalModal.booking) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/recruiter/bookings/${evalModal.booking._id}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outcome, notes: evalNotes })
      });
      if (res.ok) {
        setEvalModal({ isOpen: false, booking: null });
        setEvalNotes('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const shortlistQueue = bookings.filter(b => b.status === 'applied' && b.recruiterId === userId);

  return (
    <div>
      <div style={{ marginTop: '1rem' }}>
        <h2>Shortlist Queue</h2>
        <Card>
          <DataTable 
            headers={['Candidate', 'Company', 'Position', 'Applied Date', 'CV', 'Actions']}
            emptyMessage="No candidates awaiting shortlist."
          >
            {shortlistQueue.map(b => (
              <tr key={b._id}>
                <td>{b.candidateName}</td>
                <td>{b.positionId?.companyName || 'N/A'}</td>
                <td>{b.positionId?.title || 'N/A'}</td>
                <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                <td>
                  {b.cvUrl ? (
                    <a
                      href={`${import.meta.env.VITE_API_URL.replace('/api', '')}${b.cvUrl.startsWith('/') ? '' : '/'}${b.cvUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cv-link-btn"
                    >
                      📄 View CV
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                      No CV uploaded
                    </span>
                  )}
                </td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button style={{ background: 'green' }} onClick={() => shortlistCandidate(b._id)} disabled={isLoading}>
                    Shortlist
                  </Button>
                  <Button style={{ background: 'red' }} onClick={() => rejectAppliedCandidate(b._id)} disabled={isLoading}>
                    Reject
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>My Bookings</h2>
        <Card>
          <DataTable 
            headers={['Candidate', 'Company', 'Position', 'Date / Time', 'Status', 'Round', 'Actions']}
            emptyMessage="No bookings yet."
          >
            {bookings.map(b => (
              <tr key={b._id}>
                <td>{b.candidateId?.name || <span style={{color: 'gray'}}>Deleted User</span>} ({b.candidateEmail})</td>
                <td>
                  <span className="field-label">Company: </span>
                  <span className="field-value">{b.positionId?.companyName || 'N/A'}</span>
                </td>
                <td>
                  <span className="field-label">Position: </span>
                  <span className="field-value">{b.positionId?.title || 'N/A'}</span>
                </td>
                <td>{b.slotStart ? new Date(b.slotStart).toLocaleString() : <span style={{color: 'gray'}}>Not Scheduled</span>}</td>
                <td><StatusBadge status={b.status} type="booking" /></td>
                <td>{b.currentRound} of {b.totalRounds}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  {(b.status === 'confirmed' || b.status === 'completed') && (
                    <Button style={{ background: 'var(--primary-color)' }} onClick={() => setEvalModal({ isOpen: true, booking: b })}>
                      Evaluate
                    </Button>
                  )}
                  {b.status !== 'cancelled' && b.status !== 'rejected' && b.status !== 'selected' && b.status !== 'offer_accepted' && b.status !== 'offer_declined' && b.status !== 'withdrawn' && b.status !== 'pending_client_approval' && b.status !== 'expired' && (
                    <>
                      <Button style={{ background: 'var(--danger-color)' }} onClick={() => cancelBooking(b._id)} disabled={isCancelling}>
                        Cancel
                      </Button>
                      <Button variant="outline" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} onClick={() => withdrawBooking(b._id)} disabled={isWithdrawing}>
                        Withdraw
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <Modal 
        isOpen={evalModal.isOpen && evalModal.booking} 
        onClose={() => setEvalModal({ isOpen: false, booking: null })}
        title="Evaluate Candidate"
      >
        {evalModal.booking && (
          <>
            <p><strong>Candidate:</strong> {evalModal.booking.candidateName}</p>
            <p><strong>Round:</strong> {evalModal.booking.currentRound} of {evalModal.booking.totalRounds}</p>
            
            {evalModal.booking.roundHistory && evalModal.booking.roundHistory.length > 0 && (
              <div style={{ marginTop: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '4px' }}>
                <h4>Past Notes</h4>
                {evalModal.booking.roundHistory.map((h, idx) => (
                  <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '14px' }}>
                    <strong>Round {h.round} ({h.status}):</strong> {h.notes || <em>No notes provided.</em>}
                  </div>
                ))}
              </div>
            )}
            
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label className="input-label">Round Notes (Internal)</label>
              <textarea 
                className="input-field" 
                rows="4" 
                value={evalNotes} 
                onChange={e => setEvalNotes(e.target.value)} 
                placeholder="Enter feedback/notes for this round..."
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setEvalModal({ isOpen: false, booking: null })}>Close</Button>
              <Button style={{ background: 'red' }} onClick={() => submitOutcome('rejected')}>Reject Candidate</Button>
              <Button style={{ background: 'green' }} onClick={() => submitOutcome('passed')}>Pass Candidate</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default RecruiterBookings;
