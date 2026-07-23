import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';

import HRLayout from './pages/hr/HRLayout';
import HROverview from './pages/hr/Overview';
import HRRequests from './pages/hr/Requests';
import HRUsers from './pages/hr/Users';
import HRBookings from './pages/hr/Bookings';
import HRLogs from './pages/hr/Logs';

import RecruiterLayout from './pages/recruiter/RecruiterLayout';
import RecruiterOverview from './pages/recruiter/Overview';
import RecruiterRequests from './pages/recruiter/Requests';
import RecruiterPositions from './pages/recruiter/Positions';
import RecruiterPipeline from './pages/recruiter/Pipeline';
import RecruiterBookings from './pages/recruiter/Bookings';
import RecruiterInterviews from './pages/recruiter/Interviews';

import CandidateLayout from './pages/candidate/CandidateLayout';
import CandidateOverview from './pages/candidate/Overview';
import CandidateProfile from './pages/candidate/Profile';
import CandidatePositions from './pages/candidate/Positions';

import ClientLayout from './pages/client/ClientLayout';
import ClientOverview from './pages/client/Overview';
import ClientRequests from './pages/client/Requests';

const RoleRoute = ({ allowedRoles, children }) => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" replace />;
  try {
    const user = JSON.parse(userStr);
    if (!allowedRoles.includes(user.role)) {
      if (user.role === 'hr') return <Navigate to="/hr/overview" replace />;
      if (user.role === 'recruiter') return <Navigate to="/recruiter/overview" replace />;
      if (user.role === 'candidate') return <Navigate to="/candidate/overview" replace />;
      if (user.role === 'client') return <Navigate to="/client/overview" replace />;
      return <Navigate to="/login" replace />;
    }
  } catch(e) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        <Route element={<Layout />}>
          {/* Legacy Redirects */}
          <Route path="/hr-dashboard" element={<Navigate to="/hr/overview" replace />} />
          <Route path="/recruiter-dashboard" element={<Navigate to="/recruiter/overview" replace />} />
          <Route path="/candidate-dashboard" element={<Navigate to="/candidate/overview" replace />} />
          <Route path="/client-dashboard" element={<Navigate to="/client/overview" replace />} />

          {/* New Nested Routes */}
          <Route path="/hr" element={<RoleRoute allowedRoles={['hr']}><HRLayout /></RoleRoute>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<HROverview />} />
            <Route path="requests" element={<HRRequests />} />
            <Route path="users" element={<HRUsers />} />
            <Route path="bookings" element={<HRBookings />} />
            <Route path="logs" element={<HRLogs />} />
          </Route>

          <Route path="/recruiter" element={<RoleRoute allowedRoles={['recruiter']}><RecruiterLayout /></RoleRoute>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<RecruiterOverview />} />
            <Route path="requests" element={<RecruiterRequests />} />
            <Route path="positions" element={<RecruiterPositions />} />
            <Route path="pipeline" element={<RecruiterPipeline />} />
            <Route path="bookings" element={<RecruiterBookings />} />
            <Route path="interviews" element={<RecruiterInterviews />} />
          </Route>

          <Route path="/candidate" element={<RoleRoute allowedRoles={['candidate']}><CandidateLayout /></RoleRoute>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<CandidateOverview />} />
            <Route path="profile" element={<CandidateProfile />} />
            <Route path="positions" element={<CandidatePositions />} />
          </Route>

          <Route path="/client" element={<RoleRoute allowedRoles={['client']}><ClientLayout /></RoleRoute>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<ClientOverview />} />
            <Route path="requests" element={<ClientRequests />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
