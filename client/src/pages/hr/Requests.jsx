import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const HRRequests = () => {
  const { hiringRequests, users, token, fetchData } = useOutletContext();
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRequest, setSelectedRequest] = useState(null);

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  const openModal = (request) => setSelectedRequest(request);
  const closeModal = () => setSelectedRequest(null);

  const approveRequest = async (id, note) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/admin/hiring-requests/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const rejectRequest = async (id, reason) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/admin/hiring-requests/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updateRequestStatus = async (id, status) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/admin/hiring-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const assignRecruiter = async (id, recruiterId) => {
    if (!recruiterId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/hiring-requests/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recruiterId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to assign recruiter');
        return;
      }
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Network error assigning recruiter');
    }
  };

  const reassignRecruiter = async (id, recruiterId) => {
    if (!window.confirm('Are you sure you want to force a reassignment? This will deactivate the current linked Position and require the new Recruiter to start fresh.')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/hiring-requests/${id}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recruiterId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to reassign recruiter');
        return;
      }
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Network error reassigning recruiter');
    }
  };

  const pendingRequests = hiringRequests.filter(r => r.status === 'pending_hr_approval');
  const assignableRequests = hiringRequests.filter(r => ['approved', 'filled'].includes(r.status));

  return (
    <div>
      <div style={{ marginTop: '1rem' }}>
        <h2>Pending HR Approval</h2>
        <Card>
          <DataTable 
            headers={['Client / Company', 'Job Title / Designation', 'Headcount', 'Submitted Date', 'Actions']}
            emptyMessage="No requests pending approval."
          >
            {pendingRequests.map(r => (
              <tr key={r._id}>
                <td>
                  {r.companyName || r.clientId?.companyName || r.clientId?.name}
                  {r.companyName && r.clientId?.name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created by: {r.clientId.name}</div>}
                </td>
                <td>
                  <strong>{r.jobTitle}</strong>
                  {r.designation && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({r.designation})</div>}
                </td>
                <td>{r.headcount} slots</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '12px' }} 
                      onClick={() => {
                        const note = window.prompt("Optional Approval Note for Client:");
                        if (note !== null) {
                          approveRequest(r._id, note || '');
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button 
                      variant="outline"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '12px', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                      onClick={() => {
                        const reason = window.prompt("Optional Rejection Reason for Client:");
                        if (reason !== null) {
                          rejectRequest(r._id, reason || '');
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Assignable Hiring Requests</h2>
        <Card>
          <DataTable 
            headers={['Client / Company', 'Job Title / Designation', 'Progress', 'Status', 'Details', 'Assignment', 'Actions']}
            emptyMessage="No assignable hiring requests."
          >
            {assignableRequests.map(r => (
              <React.Fragment key={r._id}>
                <tr>
                  <td>
                    {r.companyName || r.clientId?.companyName || r.clientId?.name}
                    {r.companyName && r.clientId?.name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created by: {r.clientId.name}</div>}
                  </td>
                  <td>
                    <strong>{r.jobTitle}</strong>
                    {r.designation && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({r.designation})</div>}
                  </td>
                  <td>
                    {r.linkedPositionId 
                      ? `${r.selectedCount || 0} / ${r.headcount} Selected` 
                      : `${r.headcount} slots`}
                  </td>
                  <td><StatusBadge status={r.status} type="request" /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button style={{ padding: '0.25rem 0.5rem', fontSize: '12px' }} variant="outline" onClick={() => toggleRow(r._id)}>
                        {expandedRows[r._id] ? 'Hide' : 'Expand'}
                      </Button>
                      <Button style={{ padding: '0.25rem 0.5rem', fontSize: '12px' }} onClick={() => openModal(r)}>Modal</Button>
                    </div>
                  </td>
                  <td>
                    {r.linkedPositionId ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>
                          <strong>{r.assignedRecruiterId?.name}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Linked: {r.linkedPositionId.title}
                          </div>
                          {r.inactivePositions && r.inactivePositions.length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              (Prev: {r.inactivePositions.map(p => p.title).join(', ')})
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select id={`reassign-${r._id}`} defaultValue="" style={{ padding: '0.25rem', fontSize: '12px' }}>
                            <option value="" disabled>Reassign...</option>
                            {users.filter(u => u.role === 'recruiter' && u.isActive === true).map(u => (
                              <option key={u._id} value={u._id}>{u.name}</option>
                            ))}
                          </select>
                          <Button 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '12px', background: 'var(--danger-color)' }}
                            onClick={() => {
                              const select = document.getElementById(`reassign-${r._id}`);
                              if(select.value) reassignRecruiter(r._id, select.value);
                            }}
                          >
                            Force
                          </Button>
                        </div>
                      </div>
                    ) : r.assignedRecruiterId ? (
                      <div>
                        <strong>{r.assignedRecruiterId.name}</strong>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Pending Creation
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select 
                          id={`assign-${r._id}`}
                          className="input-field" 
                          style={{ padding: '0.25rem' }}
                          defaultValue=""
                        >
                          <option value="" disabled>Select Recruiter</option>
                          {users.filter(u => u.role === 'recruiter' && u.isActive).map(u => (
                            <option key={u._id} value={u._id}>{u.name}</option>
                          ))}
                        </select>
                        <Button 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '12px' }}
                          onClick={() => {
                            const select = document.getElementById(`assign-${r._id}`);
                            if(select.value) assignRecruiter(r._id, select.value);
                          }}
                        >
                          Assign
                        </Button>
                      </div>
                    )}
                  </td>
                  <td>
                    <select 
                      value={r.status} 
                      onChange={(e) => updateRequestStatus(r._id, e.target.value)}
                      style={{ padding: '0.25rem', borderRadius: '4px' }}
                    >
                      <option value="pending_hr_approval">Pending HR Approval</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="filled">Filled</option>
                    </select>
                  </td>
                </tr>
                {expandedRows[r._id] && (
                  <tr>
                    <td colSpan="7" style={{ padding: '0 1rem 1rem 1rem', borderTop: 'none' }}>
                      <div className="description-card" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Client Description</div>
                        <p style={{ margin: 0 }}>{r.description || 'No description provided'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </DataTable>
        </Card>
      </div>

      <Modal 
        isOpen={!!selectedRequest} 
        onClose={closeModal} 
        title="Hiring Request Details"
      >
        <div className="description-card" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Client Description</div>
          <p style={{ margin: 0 }}>{selectedRequest?.description || 'No description provided'}</p>
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button onClick={closeModal}>Close</Button>
        </div>
      </Modal>
    </div>
  );
};

export default HRRequests;
