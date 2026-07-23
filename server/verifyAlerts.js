// Node 18+ has global fetch. Let's use that.
async function verify() {
  const baseUrl = 'http://localhost:5000/api';
  try {
    // Login as admin
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ambider.com', password: 'admin@ambider.com' })
    });
    
    if (!loginRes.ok) {
      console.error('Failed to login:', loginRes.status, await loginRes.text());
      return;
    }
    
    const { token } = await loginRes.json();
    console.log('Login successful, token acquired.');
    
    // Fetch dashboard alerts
    const alertRes = await fetch(`${baseUrl}/admin/dashboard-alerts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!alertRes.ok) {
      console.error('Failed to fetch dashboard alerts:', alertRes.status, await alertRes.text());
      return;
    }
    
    const data = await alertRes.json();
    console.log('\n--- HR Dashboard Alert Counts ---');
    console.log('Pending Hiring Requests:', data.pendingRequests.length);
    console.log('Stale Bookings:', data.staleBookings.length);
    console.log('Overdue Positions:', data.overduePositions.length);
    console.log('---------------------------------\n');
    console.log('Pending requests list:', data.pendingRequests.map(r => ({ id: r._id, jobTitle: r.jobTitle, companyName: r.companyName || r.clientId?.companyName })));
    
  } catch (err) {
    console.error('Error during verification:', err);
  }
}

verify();
