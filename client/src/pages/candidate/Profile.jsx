import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Button from '../../components/Button';

const CandidateProfile = () => {
  const { profile, token, fetchPositionsAndBookings, setError } = useOutletContext();
  const [cvFile, setCvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadCv = async (e) => {
    e.preventDefault();
    if (!cvFile) return;
    setIsUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('cv', cvFile);
      const res = await fetch('http://localhost:5000/api/candidate/cv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload CV');
      alert('CV uploaded successfully!');
      setCvFile(null);
      fetchPositionsAndBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>My Profile</h2>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Current CV: </strong>
            {profile.cvUrl ? <a href={`http://localhost:5000${profile.cvUrl}`} target="_blank" rel="noreferrer">View Uploaded CV</a> : 'None uploaded'}
          </div>
          <form onSubmit={uploadCv} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files[0])} />
            <Button type="submit" disabled={!cvFile || isUploading}>Upload New CV</Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default CandidateProfile;
