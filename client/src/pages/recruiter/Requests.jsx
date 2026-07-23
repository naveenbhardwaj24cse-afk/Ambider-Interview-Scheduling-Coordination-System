import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';

const RecruiterRequests = () => {
  const { hiringRequests, token, fetchData, setError } = useOutletContext();
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [totalRounds, setTotalRounds] = useState(1);
  const [skills, setSkills] = useState('');
  const [clientDescription, setClientDescription] = useState('');
  const [openSlots, setOpenSlots] = useState(1);
  const [hiringRequestId, setHiringRequestId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createPosition = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/recruiter/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          title, companyName, totalRounds, openSlots, hiringRequestId,
          skillsRequired: skills.split(',').map(s => s.trim()), clientDescription
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create position');
      setTitle(''); setCompanyName(''); setSkills(''); setClientDescription(''); setTotalRounds(1); setOpenSlots(1); setHiringRequestId('');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <Card>
          <h3>Assigned Hiring Requests</h3>
          <DataTable 
            headers={['Title / Designation', 'Company Name', 'Status', 'Action']}
            emptyMessage="No assigned requests."
          >
            {hiringRequests.map(r => (
              <tr key={r._id}>
                <td>
                  <span className="field-label">Position: </span>
                  <span className="field-value">{r.designation || r.jobTitle || 'N/A'}</span>
                </td>
                <td>
                  <span className="field-label">Company: </span>
                  <span className="field-value">{r.companyName || r.clientId?.companyName || 'N/A'}</span>
                </td>
                <td>{r.linkedPositionId ? 'Linked' : 'Pending Creation'}</td>
                <td>
                  {!r.linkedPositionId && (
                    <Button 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '12px' }}
                      onClick={() => {
                        setTitle(r.designation || r.jobTitle);
                        setCompanyName(r.companyName || r.clientId?.companyName || '');
                        setSkills(r.skillsRequired ? r.skillsRequired.join(', ') : '');
                        setOpenSlots(r.headcount || 1);
                        setClientDescription(r.description || '');
                        setHiringRequestId(r._id);
                      }}
                    >
                      Create Position
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card>
          <h3>{hiringRequestId ? 'Create Position (Linked)' : 'Create Position'}</h3>
          <form onSubmit={createPosition} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Company Name</label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Total Rounds</label>
                <Input type="number" min="1" value={totalRounds} onChange={e => setTotalRounds(Number(e.target.value))} required />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Open Slots</label>
                <Input type="number" min="1" value={openSlots} onChange={e => setOpenSlots(Number(e.target.value))} required />
              </div>
            </div>
          <div className="input-group">
            <label className="input-label">Skills (comma separated)</label>
            <Input placeholder="e.g. React, Node, SQL" value={skills} onChange={(e) => setSkills(e.target.value)} required />
          </div>
          <div className="input-group">
              <label className="input-label">Client Description</label>
              <textarea
                className="input-field"
                rows="4"
                value={clientDescription}
                onChange={(e) => setClientDescription(e.target.value)}
                placeholder="Enter description provided by client..."
                style={{ resize: 'vertical' }}
              />
              <div className="char-counter">
                {clientDescription.length} / 500 characters
                {clientDescription.length > 500 && (
                  <span style={{ color: 'orange', marginLeft: '8px' }}>⚠️ Exceeds limit</span>
                )}
              </div>
            </div>
          <Button type="submit" disabled={isLoading}>Create Position</Button>
          {hiringRequestId && (
            <Button variant="outline" type="button" onClick={() => {
              setTitle(''); setCompanyName(''); setSkills(''); setClientDescription(''); setTotalRounds(1); setOpenSlots(1); setHiringRequestId('');
              }}>Cancel Link</Button>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
};

export default RecruiterRequests;
