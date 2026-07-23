import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import './Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('candidate');
  const [phone, setPhone] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [skills, setSkills] = useState('');
  const [interestedPosition, setInterestedPosition] = useState('');
  
  const [positions, setPositions] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLogin && role === 'candidate') {
      fetch('http://localhost:5000/api/auth/positions')
        .then(res => res.json())
        .then(data => setPositions(data))
        .catch(err => console.error(err));
    }
  }, [isLogin, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/login' : '/register';
    const payload = isLogin 
      ? { email, password }
      : { 
          name, email, password, role, 
          phone, linkedIn, 
          skillsLearned: skills.split(',').map(s => s.trim()), 
          interestedPosition 
        };

    try {
      const response = await fetch(`http://localhost:5000/api/auth${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');

      if (!isLogin) {
        setIsLogin(true);
        setError('Registration successful! Please login.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'hr') navigate('/hr-dashboard');
      else if (data.user.role === 'recruiter') navigate('/recruiter-dashboard');
      else navigate('/candidate-dashboard');

    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container fade-in">
      <div className="login-card-wrapper">
        <div className="login-header-banner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <img src="/ambider-logo.png" alt="AmbiDer Advisors & Management Consultants LLP" style={{ height: '48px', width: 'auto' }} />
          </div>
          <p>Interview Scheduling System</p>
        </div>
        
        <Card className="login-card">
          <div className="role-tabs">
            <button 
              className={`role-tab ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)} type="button">
              Login
            </button>
            <button 
              className={`role-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)} type="button">
              Register
            </button>
          </div>

          {error && <div className={`error-message ${error.includes('successful') ? 'success-msg' : ''}`}>{error}</div>}
          
          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <>
                <div className="input-group">
                  <label>I am a...</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="role-select">
                    <option value="candidate">Candidate</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="client">Client (Company)</option>
                    <option value="hr">HR (Admin)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Full Name</label>
                  <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </>
            )}

            <div className="input-group">
              <label>Email Address</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            
            <div className="input-group">
              <label>Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {!isLogin && role === 'candidate' && (
              <>
                <div className="input-group">
                  <label>Phone Number</label>
                  <Input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>LinkedIn Profile</label>
                  <Input type="url" value={linkedIn} onChange={(e) => setLinkedIn(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Skills (comma separated)</label>
                  <Input type="text" placeholder="React, Node, Python" value={skills} onChange={(e) => setSkills(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Interested Position</label>
                  <select value={interestedPosition} onChange={(e) => setInterestedPosition(e.target.value)} className="role-select">
                    <option value="">Select a position...</option>
                    {positions.map(p => (
                      <option key={p._id} value={p._id}>{p.title} at {p.companyName}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            
            <Button type="submit" variant="primary" style={{ width: '100%', marginTop: '1rem' }}>
              {isLogin ? 'Sign In' : 'Register Account'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
