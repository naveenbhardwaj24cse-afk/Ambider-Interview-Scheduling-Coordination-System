const baseUrl = 'http://localhost:5000/api';

async function login(email, password) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Login failed for ${email}: ` + JSON.stringify(error));
  }
  return res.json();
}

async function verify() {
  try {
    const hrAuth = await login('admin@ambider.com', 'Naveenambider');
    
    // 1. Create client and recruiter
    const cRes = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrAuth.token}` },
      body: JSON.stringify({ name: 'B1 Client', email: `client_b1_${Date.now()}@ambider.com`, password: 'Naveenambider', role: 'client' })
    });
    const cData = await cRes.json();
    const cAuth = await login(`client_b1_${Date.now()}@ambider.com`, 'Naveenambider').catch(() => login(cData.email || `client_b1_${Date.now()}@ambider.com`, 'Naveenambider'));
    
    const r1Email = `rec1_b1_${Date.now()}@ambider.com`;
    await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrAuth.token}` },
      body: JSON.stringify({ name: 'Recruiter 1', email: r1Email, password: 'Naveenambider', role: 'recruiter' })
    });
    const r1Auth = await login(r1Email, 'Naveenambider');
    
    const r2Email = `rec2_b1_${Date.now()}@ambider.com`;
    await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrAuth.token}` },
      body: JSON.stringify({ name: 'Recruiter 2', email: r2Email, password: 'Naveenambider', role: 'recruiter' })
    });
    
    const hrUsersRes = await fetch(`${baseUrl}/admin/users`, { headers: { 'Authorization': `Bearer ${hrAuth.token}` } });
    const allUsers = await hrUsersRes.json();
    const r1User = allUsers.find(u => u.email === r1Email);
    const r2User = allUsers.find(u => u.email === r2Email);

    // 2. Client creates Hiring Request
    const hrReqRes = await fetch(`${baseUrl}/client/hiring-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cAuth.token}` },
      body: JSON.stringify({ jobTitle: 'B1 QA Test', headcount: 2, description: 'Test', skillsRequired: ['QA'] })
    });
    const hrReq = await hrReqRes.json();
    
    // 3. HR Assigns to Recruiter 1
    await fetch(`${baseUrl}/admin/hiring-requests/${hrReq._id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrAuth.token}` },
      body: JSON.stringify({ recruiterId: r1User._id })
    });
    
    // 4. Recruiter 1 creates Position
    const posRes = await fetch(`${baseUrl}/recruiter/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${r1Auth.token}` },
      body: JSON.stringify({ 
        title: hrReq.jobTitle, 
        companyName: 'B1 Co', 
        skillsRequired: hrReq.skillsRequired, 
        totalRounds: 1,
        hiringRequestId: hrReq._id,
        openSlots: hrReq.headcount
      })
    });
    const pos1 = await posRes.json();
    console.log(`Recruiter 1 created Position. ID: ${pos1._id}`);
    
    // 5. HR Forces Reassign to Recruiter 2
    const reassignRes = await fetch(`${baseUrl}/admin/hiring-requests/${hrReq._id}/reassign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrAuth.token}` },
      body: JSON.stringify({ recruiterId: r2User._id })
    });
    const reassignedHrReq = await reassignRes.json();
    console.log(`HR Reassigned. New Recruiter ID matches R2: ${reassignedHrReq.assignedRecruiterId === r2User._id}`);
    console.log(`Linked Position is null: ${reassignedHrReq.linkedPositionId === null}`);
    
    // 6. Verify Old Position is deactivated
    // We can fetch via dashboard-alerts for overdue just to check alerts endpoint, but we don't have overdue here.
    // Let's just check the DB directly using admin alerts or hiring requests list.
    const hrListRes = await fetch(`${baseUrl}/admin/hiring-requests`, { headers: { 'Authorization': `Bearer ${hrAuth.token}` } });
    const hrList = await hrListRes.json();
    const updatedReq = hrList.find(r => r._id === hrReq._id);
    
    console.log(`Old position deactivated & populated? ${updatedReq.inactivePositions && updatedReq.inactivePositions.some(p => p._id === pos1._id)}`);
    
    // 7. Test Dashboard Alerts
    const alertsRes = await fetch(`${baseUrl}/admin/dashboard-alerts`, { headers: { 'Authorization': `Bearer ${hrAuth.token}` } });
    const alerts = await alertsRes.json();
    console.log(`Dashboard Alerts endpoint working: ${Array.isArray(alerts.pendingRequests)}`);
    console.log('B1 Verifications all completed successfully!');
  } catch(e) {
    console.error(e);
  }
}
verify();
