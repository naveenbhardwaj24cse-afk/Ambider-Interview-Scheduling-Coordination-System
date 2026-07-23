require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
async function runTests() {
  const baseUrl = 'http://localhost:5000/api';
  console.log('--- STARTING QA TESTS ---');
  
  // 1. Get Tokens
  const login = async (email, password) => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`Login failed for ${email}:`, data);
      throw new Error(`Login failed for ${email}`);
    }
    return data;
  };
  
    const hrAuth = await login('admin@ambider.com', 'Admin_HR_Ambider_2026!');
    const hrToken = hrAuth.token;
    console.log('Logged in as HR Admin');

    const recAuth = await login('recruiter@ambider.com', 'Sarah_Recruiter_Ambider_2026!');
    const recruiterToken = recAuth.token;
    console.log('Logged in as Recruiter');
    
    const candidateAuth = await login('candidate@ambider.com', 'John_Candidate_Ambider_2026!');
    const candidateToken = candidateAuth.token;
  
  // 2. Role Boundary Tests
  console.log('\n--- 1. ROLE BOUNDARY TESTS ---');
  const hrTestRes = await fetch(`${baseUrl}/admin/users`, {
    headers: { 'Authorization': `Bearer ${candidateToken}` }
  });
  console.log(`Candidate hitting /admin/users -> Status: ${hrTestRes.status} (Expected: 403)`);
  
  const recTestRes = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({})
  });
  console.log(`Candidate hitting POST /recruiter/positions -> Status: ${recTestRes.status} (Expected: 403)`);

  // 3. E2E Flow & Concurrency
  console.log('\n--- 2. E2E FLOW & CONCURRENCY ---');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // A0. Client creates hiring request, HR approves and assigns
  const clientAuth = await login('client@ambider.com', 'Naman_Client_Ambider_2026!');
  const uniqueTitle = 'Test Position QA ' + Date.now();
  const hrReqResTest = await fetch(`${baseUrl}/client/hiring-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientAuth.token}` },
    body: JSON.stringify({ jobTitle: uniqueTitle, headcount: 1, description: 'QA', skillsRequired: ['Testing'] })
  });
  const hrReqTest = await hrReqResTest.json();
  await fetch(`${baseUrl}/admin/hiring-requests/${hrReqTest._id}/approve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` } });
  
  const recUserRes = await fetch(`${baseUrl}/admin/users`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const allUsers = await recUserRes.json();
  const recruiterObj = allUsers.find(u => u.email === 'recruiter@ambider.com');
  
  await fetch(`${baseUrl}/admin/hiring-requests/${hrReqTest._id}/assign`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` }, body: JSON.stringify({ recruiterId: recruiterObj._id }) });

  const posRes = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ title: uniqueTitle, companyName: 'AmbiDer QA', skillsRequired: ['Testing'], totalRounds: 2, hiringRequestId: hrReqTest._id })
  });
  
  let position;
  let slot;
  if (posRes.status !== 200) {
    const txt = await posRes.text();
    console.log(`Failed to create position: Status ${posRes.status}, Body: ${txt}`);
  } else {
    position = await posRes.json();
    console.log(`Recruiter created position: ${position._id}`);

    const slotRes = await fetch(`${baseUrl}/recruiter/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
      body: JSON.stringify({ positionId: position._id, specificDate: tomorrow.toISOString().split('T')[0], startTime: '10:00', endTime: '11:00' })
    });
    slot = await slotRes.json();
    console.log(`Recruiter created availability slot: ${slot._id}`);
  }
  
  // C. Candidate gets positions
  const clientPosRes = await fetch(`${baseUrl}/candidate/positions`, { headers: { 'Authorization': `Bearer ${candidateToken}` } });
  const openPositions = await clientPosRes.json();
  const testPos = openPositions.find(p => p._id === position._id);
  console.log(`Candidate sees open position: ${testPos ? 'YES' : 'NO'}`);

  // D. Concurrency Test - 5 simultaneous bookings for the SAME slot
  console.log('\n--- APPLY AND SHORTLIST FLOW ---');
  const applyRes = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: position._id })
  });
  const applyData = await applyRes.json();
  console.log(`Candidate applied. Status: ${applyData.status}`);

  const shortlistRes = await fetch(`${baseUrl}/recruiter/bookings/${applyData._id}/shortlist`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${recruiterToken}` }
  });
  const shortlistData = await shortlistRes.json();
  console.log(`Recruiter shortlisted. Status: ${shortlistData.status}`);
  let bookingId = applyData._id;

  console.log('\n--- CONCURRENCY TEST ---');
  const slotStart = new Date(Date.now() + 86400000); // Tomorrow
  const slotEnd = new Date(slotStart.getTime() + 3600000);
  
  const makeBookingRequest = () => fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: position._id, slotStart, slotEnd, availabilityId: slot._id, existingBookingId: bookingId })
  });

  const promises = [makeBookingRequest(), makeBookingRequest(), makeBookingRequest(), makeBookingRequest(), makeBookingRequest()];
  const results = await Promise.all(promises);
  
  let successCount = 0;
  let conflictCount = 0;
  // bookingId is already declared above, we'll keep the value from applyData
  // but if the booking succeeds we might get the same ID back or want to verify it
  // Actually, bookingId doesn't change since we are updating the existing booking!

  for (const res of results) {
    if (res.status === 200) {
      successCount++;
      const data = await res.json();
      // bookingId is the same
    } else if (res.status === 409) {
      conflictCount++;
    } else {
      console.log(`Unexpected status: ${res.status}`);
      const txt = await res.text();
      console.log('Error output:', txt);
    }
  }
  
  console.log(`Simultaneous requests: 5`);
  console.log(`Successful bookings: ${successCount} (Expected: 1)`);
  console.log(`409 Conflicts: ${conflictCount} (Expected: 4)`);

  if (!bookingId) {
     console.log('No booking succeeded, aborting remainder of tests.');
     return;
  }

  // E. HR sees booking & NotificationLog
  console.log('\n--- HR OVERSIGHT ---');
  const hrBookRes = await fetch(`${baseUrl}/admin/bookings`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const hrBookings = await hrBookRes.json();
  const hrFoundBooking = hrBookings.find(b => b._id === bookingId);
  console.log(`HR can see booking: ${hrFoundBooking ? 'YES' : 'NO'}`);
  console.log(`Meet Link Generated: ${hrFoundBooking?.meetLink ? 'YES' : 'NO'}`);
  if (hrFoundBooking?.meetLink) {
    console.log(`   Link: ${hrFoundBooking.meetLink}`);
  }

  const hrLogRes = await fetch(`${baseUrl}/admin/notifications`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const hrLogs = await hrLogRes.json();
  const logsForBooking = hrLogs.filter(l => l.bookingId === bookingId);
  console.log(`Notification logs for this booking: ${logsForBooking.length} (Expected 1 for confirmation, but mailer might not attach bookingId, let's just count total logs in last 1 min)`);
  
  // F. Cancellation
  console.log('\n--- CANCELLATION ---');
  const makeCancelRequest = () => fetch(`${baseUrl}/candidate/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${candidateToken}` }
  });

  const cancelPromises = [makeCancelRequest(), makeCancelRequest(), makeCancelRequest(), makeCancelRequest(), makeCancelRequest()];
  const cancelResults = await Promise.all(cancelPromises);
  
  let cancelSuccessCount = 0;
  let cancelFailCount = 0;
  for (const res of cancelResults) {
    if (res.status === 200) cancelSuccessCount++;
    else if (res.status === 400) cancelFailCount++;
    else {
      console.log(`Unexpected cancellation status: ${res.status}`);
      const txt = await res.text();
      console.log('Cancellation Error output:', txt);
    }
  }
  console.log(`Concurrent cancel requests: 5`);
  console.log(`Successful cancellations: ${cancelSuccessCount} (Expected: 1)`);
  console.log(`400 Already Cancelled: ${cancelFailCount} (Expected: 4)`);
  
  const hrBookResAfter = await fetch(`${baseUrl}/admin/bookings`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const hrBookingsAfter = await hrBookResAfter.json();
  const hrFoundBookingAfter = hrBookingsAfter.find(b => b._id === bookingId);
  console.log(`Booking status after cancellation: ${hrFoundBookingAfter?.status}`);

  // F2. CV Upload Tests
  console.log('\n--- CV UPLOAD (PART 3) ---');
  const fs = require('fs');
  const path = require('path');
  const dummyFilePath = path.join(__dirname, 'dummy.pdf');
  fs.writeFileSync(dummyFilePath, 'dummy pdf content');

  try {
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(dummyFilePath)], { type: 'application/pdf' });
    formData.append('cv', fileBlob, 'dummy.pdf');
    
    const cvRes = await fetch(`${baseUrl}/candidate/cv`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${candidateToken}` },
      body: formData
    });
    const cvData = await cvRes.json();
    console.log(`Candidate CV upload response: ${cvRes.status}`);
    console.log(`CV URL: ${cvData.cvUrl}`);

    const hrUsersResAfterCv = await fetch(`${baseUrl}/admin/users`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
    const usersAfterCv = await hrUsersResAfterCv.json();
    const testCandidate = usersAfterCv.find(u => u.email === 'candidate@ambider.com');
    console.log(`HR can see Candidate CV URL: ${testCandidate?.cvUrl ? 'YES (PASS)' : 'NO (FAIL)'}`);
  } catch (e) {
    console.error('CV Upload test failed:', e.message);
  } finally {
    if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);
  }
  
  // F3. Part 4: INTERVIEW ROUNDS TRACKING & ROUND 2 CONCURRENCY
  console.log('\n--- INTERVIEW ROUNDS (PART 4) ---');
  // At this point, `bookingId` exists and is 'cancelled' from step F. 
  // Let's create a fresh application for round tracking.
  const applyR1Res = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: position._id })
  });
  const applyR1Data = await applyR1Res.json();

  const shortlistR1Res = await fetch(`${baseUrl}/recruiter/bookings/${applyR1Data._id}/shortlist`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${recruiterToken}` }
  });
  const shortlistR1Data = await shortlistR1Res.json();

  const r1Start = new Date(Date.now() + 172800000); // 2 days from now
  const r1End = new Date(r1Start.getTime() + 3600000);
  
  const slot2Res = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ positionId: position._id, specificDate: r1Start.toISOString().split('T')[0], startTime: '12:00', endTime: '13:00' })
  });
  const slot2 = await slot2Res.json();

  const r1BookRes = await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: position._id, slotStart: r1Start, slotEnd: r1End, availabilityId: slot2._id, existingBookingId: applyR1Data._id })
  });
  const r1Booking = await r1BookRes.json();
  console.log(`Round 1 booked. Status: ${r1Booking.status}, Current Round: ${r1Booking.currentRound}`);

  // Recruiter passes round 1
  const passR1Res = await fetch(`${baseUrl}/recruiter/bookings/${r1Booking._id}/outcome`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ outcome: 'passed' })
  });
  const passedR1 = await passR1Res.json();
  console.log(`Recruiter passed candidate. New status: ${passedR1.status}, Rounds Cleared: ${passedR1.roundsCleared}`);

  // Candidate books Round 2 concurrently
  console.log('\n--- ROUND 2 CONCURRENCY TEST ---');
  const r2Start = new Date(Date.now() + 259200000); // 3 days from now
  const r2End = new Date(r2Start.getTime() + 3600000);
  
  const slot3Res = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ positionId: position._id, specificDate: r2Start.toISOString().split('T')[0], startTime: '14:00', endTime: '15:00' })
  });
  const slot3 = await slot3Res.json();

  const makeR2BookingRequest = () => fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: position._id, slotStart: r2Start, slotEnd: r2End, availabilityId: slot3._id, existingBookingId: r1Booking._id })
  });

  const r2Promises = [makeR2BookingRequest(), makeR2BookingRequest(), makeR2BookingRequest(), makeR2BookingRequest(), makeR2BookingRequest()];
  const r2Results = await Promise.all(r2Promises);
  
  let r2SuccessCount = 0;
  let r2ConflictCount = 0;

  for (const res of r2Results) {
    if (res.status === 200) r2SuccessCount++;
    else if (res.status === 409) r2ConflictCount++;
  }
  
  console.log(`Simultaneous Round 2 requests: 5`);
  console.log(`Successful bookings: ${r2SuccessCount} (Expected: 1)`);
  console.log(`409 Conflicts: ${r2ConflictCount} (Expected: 4)`);

  // Verify Round History and Current Round
  const finalBookRes = await fetch(`${baseUrl}/candidate/bookings`, { headers: { 'Authorization': `Bearer ${candidateToken}` } });
  const finalBookings = await finalBookRes.json();
  const theBooking = finalBookings.find(b => b._id === r1Booking._id);
  console.log(`After Round 2 booking -> Status: ${theBooking.status}, Current Round: ${theBooking.currentRound}`);
  console.log(`Round history length: ${theBooking.roundHistory.length} (Expected: 1)`);

  // Recruiter passes round 2
  const passR2Res = await fetch(`${baseUrl}/recruiter/bookings/${r1Booking._id}/outcome`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ outcome: 'passed' })
  });
  const passedR2 = await passR2Res.json();
  console.log(`Recruiter passed candidate for Round 2. Final status: ${passedR2.status} (Expected: pending_client_approval)`);


  // F.2 Withdrawal & Concurrency (New)
  console.log('\n--- WITHDRAWAL & CONCURRENCY ---');
  
  const wdPosRes = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ title: 'Withdrawal Test Role', companyName: 'GOOGLE', totalRounds: 1, openSlots: 1, skillsRequired: ['Testing'] })
  });
  const wdPos = await wdPosRes.json();

  const withdrawSlotStart = new Date(Date.now() + 172800000); // Day after tomorrow
  const withdrawSlotEnd = new Date(withdrawSlotStart.getTime() + 3600000);
  
  const withdrawSlotRes = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ positionId: wdPos._id, specificDate: withdrawSlotStart, startTime: '15:00', endTime: '16:00' })
  });
  const withdrawSlot = await withdrawSlotRes.json();
  const withdrawApplyRes = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: wdPos._id })
  });
  const withdrawApply = await withdrawApplyRes.json();
  await fetch(`${baseUrl}/recruiter/bookings/${withdrawApply._id}/shortlist`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${recruiterToken}` }
  });

  const withdrawBookRes = await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: wdPos._id, slotStart: withdrawSlotStart, slotEnd: withdrawSlotEnd, availabilityId: withdrawSlot._id, existingBookingId: withdrawApply._id })
  });
  const withdrawBook = await withdrawBookRes.json();
  if (withdrawBook.error) {
     console.log('Withdraw Booking failed to create:', withdrawBook);
  }

  const makeWithdrawRequest = () => fetch(`${baseUrl}/recruiter/bookings/${withdrawBook._id}/withdraw`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${recruiterToken}` }
  });
  
  const withdrawPromises = [makeWithdrawRequest(), makeWithdrawRequest(), makeWithdrawRequest(), makeWithdrawRequest(), makeWithdrawRequest()];
  const withdrawResponses = await Promise.all(withdrawPromises);
  
  for (const res of withdrawResponses) {
    if (res.status !== 200 && res.status !== 400) {
      console.log(`Unexpected withdraw status: ${res.status}`);
      try { console.log(await res.clone().json()); } catch(e){}
    }
  }

  const successWithdraw = withdrawResponses.filter(r => r.status === 200).length;
  const conflictWithdraw = withdrawResponses.filter(r => r.status === 400).length;
  
  console.log(`Concurrent withdraw requests: 5`);
  console.log(`Successful withdrawals: ${successWithdraw} (Expected: 1)`);
  console.log(`400 Already Withdrawn: ${conflictWithdraw} (Expected: 4)`);

  const afterWithdrawRes = await fetch(`${baseUrl}/admin/bookings`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const afterWithdrawBooks = await afterWithdrawRes.json();
  const wdBook = afterWithdrawBooks.find(b => b._id === withdrawBook._id);
  console.log(`Booking status after withdrawal: ${wdBook?.status} (Expected: withdrawn)`);

  console.log('\n--- CANDIDATE WITHDRAWAL & CONCURRENCY ---');
  // Create a new position so candidate can apply
  const candWdPosRes = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ title: 'Candidate Withdraw Test Role', companyName: 'GOOGLE', totalRounds: 1, openSlots: 1, skillsRequired: ['Testing'] })
  });
  const candWdPos = await candWdPosRes.json();

  const candWithdrawSlotStart = new Date(Date.now() + 345600000).toISOString();
  const candWithdrawSlotEnd = new Date(Date.now() + 349200000).toISOString();
  const candWithdrawSlotRes = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recruiterToken}` },
    body: JSON.stringify({ positionId: candWdPos._id, specificDate: candWithdrawSlotStart, startTime: '16:00', endTime: '17:00' })
  });
  const candWithdrawSlot = await candWithdrawSlotRes.json();
  const candWithdrawApplyRes = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: candWdPos._id })
  });
  const candWithdrawApply = await candWithdrawApplyRes.json();
  await fetch(`${baseUrl}/recruiter/bookings/${candWithdrawApply._id}/shortlist`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${recruiterToken}` }
  });

  const candWithdrawBookRes = await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: candWdPos._id, slotStart: candWithdrawSlotStart, slotEnd: candWithdrawSlotEnd, availabilityId: candWithdrawSlot._id, existingBookingId: candWithdrawApply._id })
  });
  const candWithdrawBook = await candWithdrawBookRes.json();
  console.log("CANDIDATE WITHDRAW BOOK RES:", candWithdrawBookRes.status, candWithdrawBook);

  const makeCandWithdrawRequest = () => fetch(`${baseUrl}/candidate/bookings/${candWithdrawBook._id}/withdraw`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${candidateToken}` }
  });
  
  const candWithdrawPromises = [makeCandWithdrawRequest(), makeCandWithdrawRequest(), makeCandWithdrawRequest(), makeCandWithdrawRequest(), makeCandWithdrawRequest()];
  const candWithdrawResponses = await Promise.all(candWithdrawPromises);
  
  if (candWithdrawResponses[0].status !== 200 && candWithdrawResponses[0].status !== 400) {
    console.log("Candidate withdraw failed with status:", candWithdrawResponses[0].status);
    console.log(await candWithdrawResponses[0].text());
  }
  
  const candSuccessWithdraw = candWithdrawResponses.filter(r => r.status === 200).length;
  const candConflictWithdraw = candWithdrawResponses.filter(r => r.status === 400).length;
  
  console.log(`Concurrent candidate withdraw requests: 5`);
  console.log(`Successful candidate withdrawals: ${candSuccessWithdraw} (Expected: 1)`);
  console.log(`400 Already Withdrawn (Candidate): ${candConflictWithdraw} (Expected: 4)`);

  const afterCandWithdrawRes = await fetch(`${baseUrl}/admin/bookings`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const afterCandWithdrawBooks = await afterCandWithdrawRes.json();
  const candWdBook = afterCandWithdrawBooks.find(b => b._id === candWithdrawBook._id);
  console.log(`Booking status after candidate withdrawal: ${candWdBook?.status} (Expected: withdrawn)`);

  // G. Soft-Delete (Deactivation) Tests
  console.log('\n--- DEACTIVATION & INTEGRITY ---');
  // 1. HR gets recruiter ID
  const hrUsersRes = await fetch(`${baseUrl}/admin/users`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const users = await hrUsersRes.json();
  const recUser = users.find(u => u.email === 'recruiter@ambider.com');
  
  // 2. HR deactivates recruiter (Repeat Test)
  const makeDeactivateRequest = () => fetch(`${baseUrl}/admin/users/${recUser._id}/deactivate`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${hrToken}` }
  });
  const deactPromises = [makeDeactivateRequest(), makeDeactivateRequest(), makeDeactivateRequest(), makeDeactivateRequest(), makeDeactivateRequest()];
  const deactResults = await Promise.all(deactPromises);

  let deactSuccessCount = 0;
  let deactFailCount = 0;
  for (const res of deactResults) {
    if (res.status === 200) deactSuccessCount++;
    else if (res.status === 400) deactFailCount++;
  }
  console.log(`Concurrent deactivate requests: 5`);
  console.log(`Successful deactivations: ${deactSuccessCount} (Expected: 1)`);
  console.log(`400 Already Deactivated: ${deactFailCount} (Expected: 4)`);

  // Reactivate the recruiter so the rest of the tests and future runs don't break
  require('../models/User');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ambider');
  await mongoose.model('User').findByIdAndUpdate(recUser._id, { isActive: true });
  await mongoose.disconnect();
  
  // 3. Candidate tries to get positions
  const clientPosResAfter = await fetch(`${baseUrl}/candidate/positions`, { headers: { 'Authorization': `Bearer ${candidateToken}` } });
  const openPositionsAfter = await clientPosResAfter.json();
  const testPosAfter = openPositionsAfter.find(p => p._id === position._id);
  console.log(`Candidate sees recruiter's position after deactivation: ${testPosAfter ? 'YES (FAIL)' : 'NO (PASS)'}`);
  
  // 4. Recruiter tries to hit an endpoint (should be 401)
  const recTokenRes = await fetch(`${baseUrl}/recruiter/positions`, {
    headers: { 'Authorization': `Bearer ${recruiterToken}` }
  });
  console.log(`Recruiter with old token hitting API -> Status: ${recTokenRes.status} (Expected: 401)`);
  
  // 5. Ensure existing booking is still visible to HR (integrity)
  const hrBookResFinal = await fetch(`${baseUrl}/admin/bookings`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const hrBookingsFinal = await hrBookResFinal.json();
  const hrFoundBookingFinal = hrBookingsFinal.find(b => b._id === bookingId);
  console.log(`Booking still exists in DB and visible to HR: ${hrFoundBookingFinal ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log(`Recruiter Name on populated booking: ${hrFoundBookingFinal?.recruiterId?.name}`);

  // H. HR Coordinator - Reassignment Block Test
  console.log('\n--- HR COORDINATOR REASSIGNMENT GUARD ---');
  
  // 1. Create a client and a new active recruiter
  const hrReqClientEmail = `client_qa_${Date.now()}@ambider.com`;
  await fetch(`${baseUrl}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ name: 'HR Reassign Client', email: hrReqClientEmail, password: 'Naveenambider', role: 'client' })
  });
  const hrReqClientAuth = await login(hrReqClientEmail, 'Naveenambider');
  
  const activeRecruiterEmail = `recruiter_active_${Date.now()}@ambider.com`;
  await fetch(`${baseUrl}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ name: 'Active Recruiter', email: activeRecruiterEmail, password: 'Naveenambider', role: 'recruiter' })
  });
  const activeRecruiterAuth = await login(activeRecruiterEmail, 'Naveenambider');

  const hrReqRes = await fetch(`${baseUrl}/client/hiring-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrReqClientAuth.token}` },
    body: JSON.stringify({ jobTitle: 'Reassign Block QA', headcount: 2, description: 'Test', skillsRequired: ['QA'] })
  });
  const hrReq = await hrReqRes.json();
  console.log(`Initial Hiring Request status: ${hrReq.status} (Expected: pending_hr_approval)`);

  // J. HR Approval Gate Test
  console.log('\n--- HR APPROVAL GATE ---');
  
  // Create a dummy client and request for rejection/resubmit test
  const hrReqResRej = await fetch(`${baseUrl}/client/hiring-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrReqClientAuth.token}` },
    body: JSON.stringify({ jobTitle: 'QA Reject', headcount: 1, description: 'Test', skillsRequired: ['QA'] })
  });
  const hrReqRej = await hrReqResRej.json();
  
  // Try to assign while pending (should fail)
  const assignPendingRes = await fetch(`${baseUrl}/admin/hiring-requests/${hrReqRej._id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ recruiterId: activeRecruiterEmail }) // id doesn't matter for the status check
  });
  console.log(`Assigning pending request -> Status: ${assignPendingRes.status} (Expected: 400)`);

  // HR Rejects Request
  const rejectRes = await fetch(`${baseUrl}/admin/hiring-requests/${hrReqRej._id}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ reason: 'Need more details' })
  });
  const rejectedReq = await rejectRes.json();
  console.log(`HR Rejected request -> Status: ${rejectedReq.status}, Reason: ${rejectedReq.hrRejectionReason}`);

  // Client Resubmits
  const resubmitRes = await fetch(`${baseUrl}/client/hiring-requests/${hrReqRej._id}/resubmit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrReqClientAuth.token}` },
    body: JSON.stringify({ description: 'Detailed test description' })
  });
  const resubmittedReq = await resubmitRes.json();
  console.log(`Client Resubmitted request -> Status: ${resubmittedReq.status}, Reason cleared: ${!resubmittedReq.hrRejectionReason}`);

  // HR Approves
  const approveRes = await fetch(`${baseUrl}/admin/hiring-requests/${hrReq._id}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ note: 'Looks good' })
  });
  const approvedReq = await approveRes.json();
  console.log(`HR Approved request -> Status: ${approvedReq.status}, Note: ${approvedReq.hrApprovalNote}`);

  // 3. HR assigns it to recruiter
  const hrUsersResReassign = await fetch(`${baseUrl}/admin/users`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const usersForReassign = await hrUsersResReassign.json();
  const activeRecruiter = usersForReassign.find(u => u.email === activeRecruiterEmail);

  const assign1Res = await fetch(`${baseUrl}/admin/hiring-requests/${hrReq._id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ recruiterId: activeRecruiter._id })
  });
  console.log(`HR assigned recruiter initially -> Status: ${assign1Res.status} (Expected: 200)`);
  
  // 4. Recruiter creates linked position
  const linkedPosRes = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ 
      title: hrReq.jobTitle, 
      companyName: 'Linked Co', 
      skillsRequired: hrReq.skillsRequired, 
      totalRounds: 1,
      hiringRequestId: hrReq._id,
      openSlots: hrReq.headcount
    })
  });
  console.log(`Recruiter created linked position -> Status: ${linkedPosRes.status} (Expected: 201)`);
  
  // 5. HR tries to reassign the now-linked HiringRequest to someone else
  const reassignRes = await fetch(`${baseUrl}/admin/hiring-requests/${hrReq._id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ recruiterId: activeRecruiter._id }) // doesn't matter who
  });
  console.log(`HR trying to reassign linked request -> Status: ${reassignRes.status} (Expected: 400)`);
  const reassignData = await reassignRes.json();

  // I. Client Fields & Offer Accept/Decline Concurrency Test
  console.log('\n--- CLIENT FIELDS & OFFER ACCEPT/DECLINE CONCURRENCY ---');
  
  // 1. Client creates hiring request with Company Name and Designation
  const hrReqRes2 = await fetch(`${baseUrl}/client/hiring-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrReqClientAuth.token}` },
    body: JSON.stringify({ 
      jobTitle: 'Software Developer', 
      companyName: 'Acme Corp',
      designation: 'Staff Backend Engineer',
      headcount: 1, 
      description: 'Test Acme Request', 
      skillsRequired: ['Node.js'] 
    })
  });
  const hrReq2 = await hrReqRes2.json();
  console.log(`Client created request with Company: ${hrReq2.companyName}, Designation: ${hrReq2.designation}`);

  // 2. HR approves request
  await fetch(`${baseUrl}/admin/hiring-requests/${hrReq2._id}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` }
  });

  // 2.5 HR assigns Recruiter
  await fetch(`${baseUrl}/admin/hiring-requests/${hrReq2._id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ recruiterId: activeRecruiter._id })
  });

  // 3. Recruiter creates linked position with 1 open slot
  const linkedPosRes2 = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ 
      title: hrReq2.designation || hrReq2.jobTitle, 
      companyName: hrReq2.companyName, 
      skillsRequired: hrReq2.skillsRequired, 
      totalRounds: 1,
      hiringRequestId: hrReq2._id,
      openSlots: 1
    })
  });
  const linkedPos2 = await linkedPosRes2.json();
  console.log(`Position created. openSlots: ${linkedPos2.openSlots}, isActive: ${linkedPos2.isActive}`);

  // 4. Recruiter adds availability slot
  const slotDate = new Date(Date.now() + 432000000).toISOString(); // 5 days out
  const slotRes4 = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ positionId: linkedPos2._id, specificDate: slotDate, startTime: '09:00', endTime: '10:00' })
  });
  const slot4 = await slotRes4.json();

  // 5. Candidate books slot
  const bookApplyRes4 = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos2._id })
  });
  const bookApply4 = await bookApplyRes4.json();
  await fetch(`${baseUrl}/recruiter/bookings/${bookApply4._id}/shortlist`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${activeRecruiterAuth.token}` }
  });

  const bookRes4 = await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos2._id, slotStart: slotDate, slotEnd: slotDate, availabilityId: slot4._id, existingBookingId: bookApply4._id })
  });
  const booking4 = await bookRes4.json();
  console.log(`Booking created for candidate: ${booking4._id}`);

  // 6. Recruiter passes candidate (status -> pending_client_approval)
  const passRes4 = await fetch(`${baseUrl}/recruiter/bookings/${booking4._id}/outcome`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ outcome: 'passed' })
  });
  const passedBooking4 = await passRes4.json();
  console.log(`Recruiter passed candidate. Booking status: ${passedBooking4.status} (Expected: pending_client_approval)`);

  // Verification: Candidate cannot accept/decline yet
  const preAcceptRes = await fetch(`${baseUrl}/candidate/bookings/${booking4._id}/accept-offer`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${candidateToken}` }
  });
  console.log(`Candidate trying to accept before Client approval -> Status: ${preAcceptRes.status} (Expected: 400)`);

  // Client Approve Concurrency Test
  const makeApproveRequest = () => fetch(`${baseUrl}/client/bookings/${booking4._id}/approve-selection`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${hrReqClientAuth.token}` }
  });
  
  console.log('\n--- CLIENT APPROVAL CONCURRENCY TEST ---');
  const approvePromises = [makeApproveRequest(), makeApproveRequest(), makeApproveRequest(), makeApproveRequest(), makeApproveRequest()];
  const approveResults = await Promise.all(approvePromises);
  
  let approveSuccess = 0;
  let approveFail = 0;
  for (const res of approveResults) {
    if (res.status === 200) approveSuccess++;
    else if (res.status === 400) approveFail++;
  }
  console.log(`Concurrent client approval requests: 5`);
  console.log(`Successful approvals: ${approveSuccess} (Expected: 1)`);
  console.log(`400 Failures (Already Approved/State Guard): ${approveFail} (Expected: 4)`);

  // Status goes to selected (offer_extended)
  const afterApproveCheck = await (await fetch(`${baseUrl}/candidate/bookings`, { headers: { 'Authorization': `Bearer ${candidateToken}` } })).json();
  const approvedBooking = afterApproveCheck.find(b => b._id === booking4._id);
  console.log(`Booking status after client approval: ${approvedBooking.status} (Expected: selected)`);

  // 7. Concurrent Accept Requests (Idempotency Guard)
  const makeAcceptRequest = () => fetch(`${baseUrl}/candidate/bookings/${booking4._id}/accept-offer`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${candidateToken}` }
  });

  const acceptPromises = [makeAcceptRequest(), makeAcceptRequest(), makeAcceptRequest(), makeAcceptRequest(), makeAcceptRequest()];
  const acceptResults = await Promise.all(acceptPromises);

  let acceptSuccess = 0;
  let acceptFail = 0;
  for (const res of acceptResults) {
    if (res.status === 200) acceptSuccess++;
    else if (res.status === 400) acceptFail++;
  }
  console.log(`Concurrent accept requests: 5`);
  console.log(`Successful accepts: ${acceptSuccess} (Expected: 1)`);
  console.log(`400 Failures (Already Accepted/State Guard): ${acceptFail} (Expected: 4)`);

  // Verify Booking status, Position openSlots and isActive status
  const finalCheckRes = await fetch(`${baseUrl}/candidate/bookings`, { headers: { 'Authorization': `Bearer ${candidateToken}` } });
  const finalCheckBookings = await finalCheckRes.json();
  const verifiedBooking = finalCheckBookings.find(b => b._id === booking4._id);
  console.log(`Verified Booking status: ${verifiedBooking.status} (Expected: offer_accepted)`);

  const posCheckRes = await fetch(`${baseUrl}/candidate/positions`, { headers: { 'Authorization': `Bearer ${candidateToken}` } });
  const activePositions = await posCheckRes.json();
  const targetPos = activePositions.find(p => p._id === linkedPos2._id);
  console.log(`Is the Position still visible to candidates (isActive)? ${targetPos ? 'YES (FAIL)' : 'NO (PASS)'}`);

  // 8. Now test Rejection / Stale check with another request
  const hrReqRes3 = await fetch(`${baseUrl}/client/hiring-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrReqClientAuth.token}` },
    body: JSON.stringify({ 
      jobTitle: 'Frontend Engineer', 
      companyName: 'Acme Corp',
      designation: 'Senior UI Engineer',
      headcount: 1, 
      description: 'Test Acme Request Decline', 
      skillsRequired: ['React'] 
    })
  });
  const hrReq3 = await hrReqRes3.json();

  await fetch(`${baseUrl}/admin/hiring-requests/${hrReq3._id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` },
    body: JSON.stringify({ recruiterId: activeRecruiter._id })
  });

  const linkedPosRes3 = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ 
      title: hrReq3.designation || hrReq3.jobTitle, 
      companyName: hrReq3.companyName, 
      skillsRequired: hrReq3.skillsRequired, 
      totalRounds: 1,
      hiringRequestId: hrReq3._id,
      openSlots: 1
    })
  });
  const linkedPos3 = await linkedPosRes3.json();

  const slotDate2 = new Date(Date.now() + 518400000).toISOString(); // 6 days out
  const slotRes5 = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ positionId: linkedPos3._id, specificDate: slotDate2, startTime: '10:00', endTime: '11:00' })
  });
  const slot5 = await slotRes5.json();

  // Apply and Shortlist first
  const bookApplyRes5 = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos3._id })
  });
  const bookApply5 = await bookApplyRes5.json();
  
  await fetch(`${baseUrl}/recruiter/bookings/${bookApply5._id}/shortlist`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${activeRecruiterAuth.token}` }
  });

  const bookRes5 = await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos3._id, slotStart: slotDate2, slotEnd: slotDate2, availabilityId: slot5._id, existingBookingId: bookApply5._id })
  });
  const booking5 = await bookRes5.json();

  await fetch(`${baseUrl}/recruiter/bookings/${booking5._id}/outcome`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ outcome: 'passed' })
  });

  // K. CANDIDATE DOUBLE-BOOKING CHECK
  console.log('\n--- CANDIDATE DOUBLE-BOOKING CHECK ---');
  // 1. Create a new slot for linkedPos3 that overlaps with booking5
  const slotDateOverlap = new Date(Date.now() + 518400000).toISOString(); // same day as booking5
  const hrReqRes4 = await fetch(`${baseUrl}/client/hiring-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrReqClientAuth.token}` },
    body: JSON.stringify({ jobTitle: 'DB Admin', headcount: 1, description: 'Test', skillsRequired: ['SQL'] })
  });
  const hrReq4 = await hrReqRes4.json();
  console.log(`HR Req 4 -> Status: ${hrReqRes4.status}`);

  const appRes = await fetch(`${baseUrl}/admin/hiring-requests/${hrReq4._id}/approve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` } });
  console.log(`Approve 4 -> Status: ${appRes.status}`);

  const asgRes = await fetch(`${baseUrl}/admin/hiring-requests/${hrReq4._id}/assign`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` }, body: JSON.stringify({ recruiterId: activeRecruiter._id }) });
  console.log(`Assign 4 -> Status: ${asgRes.status}`);
  
  const linkedPosRes4 = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ title: 'DB Admin', companyName: 'Acme', skillsRequired: ['SQL'], totalRounds: 1, hiringRequestId: hrReq4._id, openSlots: 1 })
  });
  const linkedPos4 = await linkedPosRes4.json();
  console.log(`Setup position 4 -> Status: ${linkedPosRes4.status}, _id: ${linkedPos4._id}`);

  const slotResOverlap = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ positionId: linkedPos4._id, specificDate: slotDateOverlap, startTime: '10:30', endTime: '11:30' })
  });
  const slotOverlap = await slotResOverlap.json();

  const bookApplyResOverlap = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos4._id })
  });
  const bookApplyOverlap = await bookApplyResOverlap.json();
  await fetch(`${baseUrl}/recruiter/bookings/${bookApplyOverlap._id}/shortlist`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${activeRecruiterAuth.token}` } });

  const slotDateStartOverlap = new Date(Date.now() + 518400000); // 6 days from now
  const slotDateEndOverlap = new Date(slotDateStartOverlap.getTime() + 3600000); // +1 hour

  await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos4._id, slotStart: slotDateStartOverlap.toISOString(), slotEnd: slotDateEndOverlap.toISOString(), availabilityId: slotOverlap._id, existingBookingId: bookApplyOverlap._id })
  });

  const linkedPosRes5 = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ title: 'DB Admin 2', companyName: 'Acme', skillsRequired: ['SQL'], totalRounds: 1, openSlots: 1 })
  });
  const linkedPos5 = await linkedPosRes5.json();

  const slotResOverlap5 = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ positionId: linkedPos5._id, specificDate: slotDateStartOverlap.toISOString(), startTime: '10:30', endTime: '11:30' })
  });
  const slotOverlap5 = await slotResOverlap5.json();

  const bookApplyResOverlap5 = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos5._id })
  });
  const bookApplyOverlap5 = await bookApplyResOverlap5.json();
  await fetch(`${baseUrl}/recruiter/bookings/${bookApplyOverlap5._id}/shortlist`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${activeRecruiterAuth.token}` } });

  const bookResOverlap = await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos5._id, slotStart: slotDateStartOverlap.toISOString(), slotEnd: slotDateEndOverlap.toISOString(), availabilityId: slotOverlap5._id, existingBookingId: bookApplyOverlap5._id })
  });
  console.log(`Candidate booking overlapping slot -> Status: ${bookResOverlap.status} (Expected: 409)`);
  if (bookResOverlap.status !== 409) {
     console.log(await bookResOverlap.text());
  } else {
     const overlapData = await bookResOverlap.json();
     console.log(`Overlap Error: ${overlapData.error}`);
     console.log(`Overlap Position: ${overlapData.conflictingPositionTitle}`);
  }

  // Create a NON-overlapping slot for the same position
  const slotDateStartNoOverlap = new Date(Date.now() + 518400000 + 7200000); // 6 days from now + 2 hours
  const slotDateEndNoOverlap = new Date(slotDateStartNoOverlap.getTime() + 3600000); // +1 hour

  const slotResNoOverlap = await fetch(`${baseUrl}/recruiter/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ positionId: linkedPos4._id, specificDate: slotDateStartNoOverlap.toISOString(), startTime: '14:00', endTime: '15:00' })
  });
  const slotNoOverlap = await slotResNoOverlap.json();
  
  const bookResNoOverlap = await fetch(`${baseUrl}/candidate/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos4._id, slotStart: slotDateStartNoOverlap.toISOString(), slotEnd: slotDateEndNoOverlap.toISOString(), availabilityId: slotNoOverlap._id, existingBookingId: bookApplyOverlap._id })
  });
  console.log(`Candidate booking NON-overlapping slot -> Status: ${bookResNoOverlap.status} (Expected: 200)`);
  if (bookResNoOverlap.status !== 200) {
      console.log(await bookResNoOverlap.text());
  }

  // --- HR STALE ALERTS VERIFICATION ---
  // --- HR STALE ALERTS VERIFICATION ---
  const BookingModel = require('../models/Booking');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ambider');
  
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - 6);
  await BookingModel.findByIdAndUpdate(booking5._id, { updatedAt: staleDate }, { timestamps: false });
  
  const alertRes = await fetch(`${baseUrl}/admin/dashboard-alerts`, { headers: { 'Authorization': `Bearer ${hrToken}` } });
  const alerts = await alertRes.json();
  const staleMatch = alerts.staleBookings.find(b => b._id === booking5._id);
  console.log(`Did HR stale alert count pending_client_approval? ${staleMatch ? 'YES (PASS)' : 'NO (FAIL)'}`);
  // Mongoose connection stays open for Item 11 test

  // Client Reject Concurrency Test
  const makeRejectRequest = () => fetch(`${baseUrl}/client/bookings/${booking5._id}/reject-selection`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hrReqClientAuth.token}` 
    },
    body: JSON.stringify({ notes: 'Rejected by client selection gate' })
  });

  console.log('\n--- CLIENT REJECTION CONCURRENCY TEST ---');
  const rejectPromises = [makeRejectRequest(), makeRejectRequest(), makeRejectRequest(), makeRejectRequest(), makeRejectRequest()];
  const rejectResults = await Promise.all(rejectPromises);

  let rejectSuccess = 0;
  let rejectFail = 0;
  for (const res of rejectResults) {
    if (res.status === 200) rejectSuccess++;
    else if (res.status === 400) rejectFail++;
  }
  console.log(`Concurrent client rejection requests: 5`);
  console.log(`Successful rejections: ${rejectSuccess} (Expected: 1)`);
  console.log(`400 Failures (Already Rejected/State Guard): ${rejectFail} (Expected: 4)`);

  const finalCheckBookings3 = await (await fetch(`${baseUrl}/candidate/bookings`, { headers: { 'Authorization': `Bearer ${candidateToken}` } })).json();
  const verifiedBooking3 = finalCheckBookings3.find(b => b._id === booking5?._id);
  if (verifiedBooking3) {
    console.log(`Verified Booking status: ${verifiedBooking3.status} (Expected: rejected)`);
    console.log(`Verified Rejection notes stored: ${verifiedBooking3.clientRejectionNotes} (Expected: Rejected by client selection gate)`);
  } else {
    console.log('Skipped verifiedBooking3 check because booking5 was not found.');
  }

  // L. ITEM 11: OFFER EXPIRATION
  console.log('\n--- OFFER EXPIRATION TEST ---');
  
  // Create a position and a booking directly for simplicity to get to pending_client_approval
  const hrReqRes11 = await fetch(`${baseUrl}/client/hiring-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrReqClientAuth.token}` },
    body: JSON.stringify({ jobTitle: 'QA Tester', headcount: 1, description: 'Test 11', skillsRequired: ['QA'] })
  });
  const hrReq11 = await hrReqRes11.json();
  
  await fetch(`${baseUrl}/admin/hiring-requests/${hrReq11._id}/approve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` } });
  await fetch(`${baseUrl}/admin/hiring-requests/${hrReq11._id}/assign`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hrToken}` }, body: JSON.stringify({ recruiterId: activeRecruiter._id }) });
  
  const linkedPosRes11 = await fetch(`${baseUrl}/recruiter/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeRecruiterAuth.token}` },
    body: JSON.stringify({ title: 'QA Tester 11', companyName: 'Acme QA', skillsRequired: ['QA'], totalRounds: 1, hiringRequestId: hrReq11._id, openSlots: 1 })
  });
  const linkedPos11 = await linkedPosRes11.json();
  console.log('linkedPosRes11 status:', linkedPosRes11.status, linkedPos11);
  
  const bookApplyRes11 = await fetch(`${baseUrl}/candidate/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
    body: JSON.stringify({ positionId: linkedPos11._id })
  });
  const bookApply11 = await bookApplyRes11.json();
  console.log('bookApplyRes11 status:', bookApplyRes11.status, bookApply11);
  
  // Fast track booking11 to pending_client_approval
  await BookingModel.findByIdAndUpdate(bookApply11._id, { 
    status: 'pending_client_approval',
    candidateName: 'John Candidate',
    candidateEmail: 'candidate@ambider.com',
    currentRound: 1, totalRounds: 1 
  });
  
  // 1. Client approves -> selected -> offerExpiresAt set
  const clientApprove11 = await fetch(`${baseUrl}/client/bookings/${bookApply11._id}/approve-selection`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${hrReqClientAuth.token}` }
  });
  const clientApprove11Json = await clientApprove11.json();
  console.log(`Client approve 11 -> Status: ${clientApprove11.status}`, clientApprove11Json);
  
  const bookingAfterApprove = await BookingModel.findById(bookApply11._id);
  console.log(`Booking Status (Expected: selected): ${bookingAfterApprove.status}`);
  console.log(`offerExpiresAt is set: ${!!bookingAfterApprove.offerExpiresAt} (Expected: true)`);
  if (bookingAfterApprove.offerExpiresAt) {
    const diffHours = (bookingAfterApprove.offerExpiresAt - new Date()) / (1000 * 60 * 60);
    console.log(`Expiry is ~${Math.round(diffHours)} hours from now (Expected: ~168)`);
  }

  // 2. Re-extend on non-expired -> 400
  const reextendFailRes = await fetch(`${baseUrl}/admin/bookings/${bookApply11._id}/re-extend-offer`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${hrToken}` }
  });
  console.log(`Re-extend non-expired -> Status: ${reextendFailRes.status} (Expected: 400)`);
  
  // 3. Manually backdate offerExpiresAt
  await BookingModel.findByIdAndUpdate(bookApply11._id, { 
    offerExpiresAt: new Date(Date.now() - 3600000) // 1 hour ago
  });
  
  // 4. Trigger Cron Logic Manually (Simulated)
  console.log('Simulating Cron Job...');
  const expiredBookings = await BookingModel.find({ status: 'selected', offerExpiresAt: { $lt: new Date() } });
  for (const b of expiredBookings) {
    b.status = 'expired';
    await b.save();
  }
  
  const bookingAfterCron = await BookingModel.findById(bookApply11._id);
  console.log(`Booking Status after Cron (Expected: expired): ${bookingAfterCron.status}`);
  
  // 5. HR Re-extends the offer
  const reextendSuccessRes = await fetch(`${baseUrl}/admin/bookings/${bookApply11._id}/re-extend-offer`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${hrToken}` }
  });
  console.log(`Re-extend expired -> Status: ${reextendSuccessRes.status} (Expected: 200)`);
  
  const bookingAfterExtend = await BookingModel.findById(bookApply11._id);
  console.log(`Booking Status after Re-extend (Expected: selected): ${bookingAfterExtend.status}`);
  if (bookingAfterExtend.offerExpiresAt) {
    const newDiffHours = (bookingAfterExtend.offerExpiresAt - new Date()) / (1000 * 60 * 60);
    console.log(`New Expiry is ~${Math.round(newDiffHours)} hours from now (Expected: ~168)`);
  }
  
  console.log('\n--- DONE ---');
}

runTests().catch(console.error);
