import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';

const HRUsers = () => {
  const { users, token, fetchData } = useOutletContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('recruiter');
  const [cvFile, setCvFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  const createUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('role', role);
      if (role === 'candidate' && cvFile) {
        formData.append('cv', cvFile);
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setName(''); setEmail(''); setPassword(''); setCvFile(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deactivateUser = async (id) => {
    setIsDeactivating(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${id}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
      <div style={{ flex: 1 }}>
        <Card>
          <h3>Create User</h3>
          {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}
          <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <Input type="email" placeholder="john@ambider.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <Input type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Role</label>
              <select className="input-field" value={role} onChange={e => setRole(e.target.value)} required>
                <option value="hr">HR</option>
                <option value="recruiter">Recruiter</option>
                <option value="candidate">Candidate</option>
              </select>
            </div>
            {role === 'candidate' && (
              <div className="input-group">
                <label className="input-label">CV / Resume (PDF/DOC)</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files[0])} className="input-field" />
              </div>
            )}
            <Button type="submit" disabled={isLoading}>Create User</Button>
          </form>
        </Card>
      </div>

      <div style={{ flex: 2 }}>
        <h3>User Management</h3>
        <Card>
          <DataTable 
            headers={['Name', 'Email', 'Role', 'CV', 'Status', 'Actions']}
            emptyMessage="No users found."
          >
            {users.map(u => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                <td>
                  {u.cvUrl ? <a href={`${import.meta.env.VITE_API_URL.replace('/api', '')}${u.cvUrl}`} target="_blank" rel="noreferrer">View CV</a> : '-'}
                </td>
                <td>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                    background: u.isActive ? '#dcfce7' : '#fee2e2',
                    color: u.isActive ? '#166534' : '#991b1b'
                  }}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  {u.role !== 'hr' && u.isActive && (
                    <Button variant="outline" onClick={() => deactivateUser(u._id)} disabled={isDeactivating}>Deactivate</Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </div>
  );
};

export default HRUsers;
