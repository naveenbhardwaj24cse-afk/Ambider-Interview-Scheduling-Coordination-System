import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const HRBookings = () => {
  const { bookings, staff, token, fetchData } = useOutletContext();
  const [selectedBooking, setSelectedBooking] = useState(null);

  const openBookingModal = (booking) => setSelectedBooking(booking);
  const closeBookingModal = () => setSelectedBooking(null);

  const reextendOffer = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/bookings/${id}/re-extend-offer`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to re-extend offer');
      alert('Offer has been successfully reinstated.');
      fetchData();
      if (selectedBooking && selectedBooking._id === id) {
        setSelectedBooking(data);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const assignInterviewer = async (bookingId, round, interviewerId) => {
    if (!interviewerId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/bookings/${bookingId}/assign-interviewer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ round, interviewerId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to assign interviewer');
        return;
      }
      alert('Interviewer assigned successfully!');
      if (selectedBooking && selectedBooking._id === bookingId) {
        setSelectedBooking(data);
      }
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Network error assigning interviewer');
    }
  };

  return (
    <div>
      <div style={{ marginTop: '1rem' }}>
        <h2>All Bookings (Oversight)</h2>
        <Card>
          <DataTable 
            headers={['Recruiter', 'Candidate', 'Time', 'Status', 'Meet Link', 'Actions']}
            emptyMessage="No bookings in system."
          >
            {bookings.map(b => (
              <tr key={b._id}>
                <td>{b.recruiterId?.name || <span style={{color: 'gray'}}>Deleted User</span>}</td>
                <td>{b.candidateId?.name || <span style={{color: 'gray'}}>Deleted User</span>}</td>
                <td>{b.slotStart ? new Date(b.slotStart).toLocaleString() : <span style={{color: 'gray'}}>Not Scheduled</span>}</td>
                <td style={{ textTransform: 'capitalize' }}>
                  <StatusBadge status={b.status} type="booking" />
                </td>
                <td>{b.meetLink ? <a href={b.meetLink} target="_blank" rel="noreferrer">Link</a> : <span style={{color: 'gray'}}>N/A</span>}</td>
                <td>
                  <Button variant="outline" onClick={() => openBookingModal(b)}>Manage</Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <Modal 
        isOpen={!!selectedBooking} 
        onClose={closeBookingModal} 
        title="Booking Details"
        maxWidth="600px"
      >
        {selectedBooking && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <p><strong>Candidate:</strong> {selectedBooking.candidateId?.name} ({selectedBooking.candidateEmail})</p>
              <p><strong>Position:</strong> {selectedBooking.positionId?.title}</p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <strong>Status:</strong> <StatusBadge status={selectedBooking.status} type="booking" />
                {selectedBooking.status === 'expired' && (
                  <Button size="small" onClick={() => reextendOffer(selectedBooking._id)}>
                    Re-extend Offer
                  </Button>
                )}
              </p>
            </div>

            <div className="description-card" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Round Assignments</div>
              <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Round</th>
                    <th style={{ padding: '0.5rem' }}>Current Interviewer</th>
                    <th style={{ padding: '0.5rem' }}>Assign New</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: selectedBooking.totalRounds || 1 }, (_, i) => i + 1).map(round => {
                    const assignment = selectedBooking.interviewerAssignments?.find(a => a.round === round);
                    let assignedName = 'Unassigned';
                    if (assignment) {
                      const s = staff.find(st => st._id === assignment.interviewerId);
                      assignedName = s ? s.name : 'Unknown';
                    }
                    return (
                      <tr key={round} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>Round {round}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ fontWeight: assignment ? 'bold' : 'normal', color: assignment ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {assignedName}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select 
                              id={`select-interviewer-${round}`}
                              style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)', flex: 1 }}
                              defaultValue=""
                            >
                              <option value="" disabled>Select Staff...</option>
                              {staff.map(s => (
                                <option key={s._id} value={s._id}>{s.name} - {s.role}</option>
                              ))}
                            </select>
                            <Button 
                              variant="primary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '12px' }}
                              onClick={() => {
                                const val = document.getElementById(`select-interviewer-${round}`).value;
                                assignInterviewer(selectedBooking._id, round, val);
                              }}
                            >
                              Assign
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <Button variant="outline" onClick={closeBookingModal}>Close</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default HRBookings;
