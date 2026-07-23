import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, BookMarked, Video, LogOut } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ role }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  let dashboardRoute = '/login';
  let roleDisplay = '';
  
  if (role === 'hr') {
    dashboardRoute = '/hr-dashboard';
    roleDisplay = 'HR Admin';
  } else if (role === 'recruiter') {
    dashboardRoute = '/recruiter-dashboard';
    roleDisplay = 'Recruiter';
  } else if (role === 'candidate') {
    dashboardRoute = '/candidate-dashboard';
    roleDisplay = 'Candidate';
  } else if (role === 'client') {
    dashboardRoute = '/client-dashboard';
    roleDisplay = 'Client (Company)';
  }

  const navItems = {
    hr: [
      { name: 'Overview', icon: LayoutDashboard, href: '/hr/overview' },
      { name: 'Requests', icon: BookMarked, href: '/hr/requests' },
      { name: 'Users', icon: Users, href: '/hr/users' },
      { name: 'Bookings', icon: CalendarDays, href: '/hr/bookings' },
      { name: 'Logs', icon: BookMarked, href: '/hr/logs' }
    ],
    recruiter: [
      { name: 'Overview', icon: LayoutDashboard, href: '/recruiter/overview' },
      { name: 'Requests', icon: BookMarked, href: '/recruiter/requests' },
      { name: 'Positions', icon: BookMarked, href: '/recruiter/positions' },
      { name: 'Pipeline', icon: Users, href: '/recruiter/pipeline' },
      { name: 'Bookings', icon: CalendarDays, href: '/recruiter/bookings' },
      { name: 'Interviews', icon: Video, href: '/recruiter/interviews' }
    ],
    candidate: [
      { name: 'Overview', icon: LayoutDashboard, href: '/candidate/overview' },
      { name: 'Profile', icon: Users, href: '/candidate/profile' },
      { name: 'Positions', icon: BookMarked, href: '/candidate/positions' }
    ],
    client: [
      { name: 'Overview', icon: LayoutDashboard, href: '/client/overview' },
      { name: 'My Requests', icon: CalendarDays, href: '/client/requests' }
    ]
  };

  const currentNav = navItems[role] || navItems.candidate;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <img src="/ambider-logo.png" alt="AmbiDer Advisors & Management Consultants LLP" style={{ height: '48px', width: 'auto' }} />
        </div>
      </div>

      <div className="role-badge">
        <Users size={16} />
        <span>{roleDisplay}</span>
      </div>

      <nav className="sidebar-nav">
        {currentNav.map((item, idx) => (
          <NavLink 
            key={idx} 
            to={item.href} 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
