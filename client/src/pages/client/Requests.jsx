import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';

const ClientRequests = () => {
  const { requests, token, fetchRequests, setError } = useOutletContext();
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [skillsRequired, setSkillsRequired] = useState('');
  const [requesterDesignation, setRequesterDesignation] = useState('');
  const [headcount, setHeadcount] = useState(1);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editRequestId, setEditRequestId] = useState(null);

  const createRequest = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const url = editRequestId 
        ? `${import.meta.env.VITE_API_URL}/client/hiring-requests/${editRequestId}/resubmit`
        : `${import.meta.env.VITE_API_URL}/client/hiring-requests`;
      const method = editRequestId ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobTitle, companyName, designation, requesterDesignation, skillsRequired, headcount, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      setJobTitle(''); setCompanyName(''); setDesignation(''); setRequesterDesignation(''); setSkillsRequired(''); setHeadcount(1); setDescription('');
      setEditRequestId(null);
      alert(editRequestId ? 'Hiring request resubmitted to HR.' : 'Hiring request submitted to HR.');
      fetchRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditResubmit = (req) => {
    setEditRequestId(req._id);
    setJobTitle(req.jobTitle);
    setCompanyName(req.companyName || '');
    setDesignation(req.designation || '');
    setRequesterDesignation(req.requesterDesignation || '');
    setSkillsRequired(Array.isArray(req.skillsRequired) ? req.skillsRequired.join(', ') : (req.skillsRequired || ''));
    setHeadcount(req.headcount);
    setDescription(req.description);
    document.getElementById('create-request').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
      <Card style={{ flex: 1 }} id="create-request">
        <h3>{editRequestId ? 'Edit Hiring Request' : 'Create Hiring Request'}</h3>
        <form onSubmit={createRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Job Title</label>
            <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Company Name</label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Your Designation</label>
            <Input value={requesterDesignation} onChange={e => setRequesterDesignation(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Designation / Role Title</label>
            <Input value={designation} onChange={e => setDesignation(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Skills Required (comma separated)</label>
            <Input value={skillsRequired} onChange={e => setSkillsRequired(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Headcount</label>
            <Input type="number" min="1" value={headcount} onChange={e => setHeadcount(Number(e.target.value))} required />
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea 
              value={description} onChange={e => setDescription(e.target.value)} required 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', minHeight: '100px' }}
            />
          </div>
          <Button type="submit" disabled={isLoading}>{editRequestId ? 'Resubmit Request' : 'Submit Request'}</Button>
          {editRequestId && (
            <Button variant="outline" type="button" onClick={() => {
              setEditRequestId(null);
              setJobTitle(''); setCompanyName(''); setDesignation(''); setRequesterDesignation(''); setSkillsRequired(''); setHeadcount(1); setDescription('');
            }}>
              Cancel Edit
            </Button>
          )}
        </form>
      </Card>

      <Card style={{ flex: 1.5 }} id="my-requests">
        <h3>My Hiring Requests</h3>
          {requests.length === 0 ? <p>No requests submitted.</p> : (
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>Job Title / Designation</th>
                <th>Company Name</th>
                <th>Progress / Headcount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <React.Fragment key={r._id}>
                  <tr style={{ borderBottom: r.breakdown ? 'none' : '1px solid var(--border-color)' }}>
                    <td>
                      <strong>{r.jobTitle}</strong>
                      {r.designation && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({r.designation})</div>}
                    </td>
                    <td>{r.companyName || 'N/A'}</td>
                    <td>
                      {r.linkedPositionId 
                        ? `${r.filledCount || 0} / ${r.headcount} Filled` 
                        : `${r.headcount} Slots`}
                    </td>
                    <td style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                        background: r.status === 'approved' ? '#dcfce7' : 
                                   r.status === 'rejected' ? '#fee2e2' : 
                                   r.status === 'filled' ? '#dbeafe' : '#fef08a',
                        color: r.status === 'approved' ? '#166534' : 
                               r.status === 'rejected' ? '#991b1b' : 
                               r.status === 'filled' ? '#1e40af' : '#854d0e'
                      }}>
                        {r.status === 'pending_hr_approval' ? 'Awaiting HR Review' : r.status}
                      </span>
                      {r.status === 'approved' && r.hrApprovalNote && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 'normal' }}>
                          Note: {r.hrApprovalNote}
                        </div>
                      )}
                      {r.status === 'rejected' && r.hrRejectionReason && (
                        <div style={{ fontSize: '11px', color: 'var(--danger-color)', marginTop: '4px', fontWeight: 'normal' }}>
                          Reason: {r.hrRejectionReason}
                        </div>
                      )}
                      {r.status === 'rejected' && (
                        <div style={{ marginTop: '8px' }}>
                          <Button 
                            variant="outline" 
                            style={{ fontSize: '11px', padding: '0.2rem 0.4rem' }}
                            onClick={() => handleEditResubmit(r)}
                          >
                            Edit & Resubmit
                          </Button>
                        </div>
                      )}
                    </td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                  {r.breakdown && (
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td colSpan="5" style={{ background: 'rgba(0, 0, 0, 0.02)', padding: '0.5rem 1rem', fontSize: '12px' }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>Pipeline Breakdown:</span>
                          <span>Round 1: <strong>{r.breakdown.round1}</strong></span>
                          <span>Round 2: <strong>{r.breakdown.round2}</strong></span>
                          {r.breakdown.round3Plus > 0 && <span>Round 3+: <strong>{r.breakdown.round3Plus}</strong></span>}
                          <span>Pending Next: <strong style={{ color: '#d97706' }}>{r.breakdown.pendingNext}</strong></span>
                          <span>Selected (Offer Ext): <strong style={{ color: '#059669' }}>{r.breakdown.selected}</strong></span>
                          <span>Offer Accepted: <strong style={{ color: '#15803d' }}>{r.breakdown.offerAccepted}</strong></span>
                          <span>Offer Declined: <strong style={{ color: '#b91c1c' }}>{r.breakdown.offerDeclined}</strong></span>
                          <span>Rejected: <strong style={{ color: '#dc2626' }}>{r.breakdown.rejected}</strong></span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <td colSpan="5" style={{ background: '#fafafa', padding: '1rem', fontSize: '13px' }}>
                      <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Candidate Progress:</strong>
                      {!r.bookings || r.bookings.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No candidates in progress
                        </span>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <tbody>
                            {r.bookings.map(b => (
                              <tr key={b._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.5rem 1rem', width: '30%' }}>{b.candidateId?.name || 'Unknown Candidate'}</td>
                                <td style={{ padding: '0.5rem 1rem', width: '30%' }}>Round {b.currentRound} of {b.totalRounds}</td>
                                <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                                  <span style={{ 
                                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                                    background: b.status === 'confirmed' ? '#dcfce7' : 
                                               b.status === 'pending_next_round' ? '#fef08a' :
                                               b.status === 'selected' ? '#bbf7d0' :
                                               b.status === 'offer_accepted' ? '#dcfce7' :
                                               b.status === 'offer_declined' ? '#fee2e2' :
                                               b.status === 'withdrawn' ? '#fde047' :
                                               b.status === 'rejected' ? '#fee2e2' : 
                                               b.status === 'pending_client_approval' ? '#dbeafe' : '#f3f4f6',
                                    color: b.status === 'confirmed' ? '#166534' : 
                                           b.status === 'pending_next_round' ? '#854d0e' :
                                           b.status === 'selected' ? '#166534' :
                                           b.status === 'offer_accepted' ? '#166534' :
                                           b.status === 'offer_declined' ? '#991b1b' :
                                           b.status === 'withdrawn' ? '#854d0e' :
                                           b.status === 'rejected' ? '#991b1b' : 
                                           b.status === 'pending_client_approval' ? '#1e40af' : '#374151'
                                  }}>
                                    {b.status === 'pending_client_approval' ? 'Pending Approval' : b.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

export default ClientRequests;
