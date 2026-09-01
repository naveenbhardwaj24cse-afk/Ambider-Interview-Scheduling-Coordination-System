import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';

const HRUsers = () => {
  const { users, token, fetchData } = useOutletContext();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('recruiter');
  const [cvFile, setCvFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      setShowModal(false);
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

  const deleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
      return;
    }
    setIsDeleting(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>User Management</h3>
        <Button onClick={() => setShowModal(true)}>+ Add New User</Button>
      </div>
      
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {u.role !== 'hr' && u.isActive && (
                    <Button variant="outline" onClick={() => deactivateUser(u._id)} disabled={isDeactivating}>Deactivate</Button>
                  )}
                  {u.role !== 'hr' && (
                    <Button 
                      variant="outline" 
                      onClick={() => deleteUser(u._id)} 
                      disabled={isDeleting}
                      style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add New User</h2>
            </div>
            <form onSubmit={createUser} className="modal-body">
              {error && <div style={{ color: 'var(--danger-color)' }}>{error}</div>}
              <div>
                <label>Full Name</label>
                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label>Email</label>
                <input type="email" placeholder="john@ambider.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label>Password</label>
                <input type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div>
                <label>Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} required>
                  <option value="hr">HR</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="candidate">Candidate</option>
                </select>
              </div>
              {role === 'candidate' && (
                <div>
                  <label>CV / Resume (PDF/DOC)</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files[0])} />
                </div>
              )}
              <div className="modal-footer">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Create User'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRUsers;
