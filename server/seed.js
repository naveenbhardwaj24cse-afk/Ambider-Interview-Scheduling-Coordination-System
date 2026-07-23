require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); 
const User = require('./models/User');
const Position = require('./models/Position');
const Availability = require('./models/Availability');
const Booking = require('./models/Booking');
const HiringRequest = require('./models/HiringRequest');
const NotificationLog = require('./models/NotificationLog');
const CandidateProfile = require('./models/CandidateProfile');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Clean slate
    await Position.deleteMany({});
    await Availability.deleteMany({});
    await Booking.deleteMany({});
    await Booking.collection.dropIndexes().catch(() => {});
    await Booking.syncIndexes();
    await HiringRequest.deleteMany({});
    await NotificationLog.deleteMany({});
    await CandidateProfile.deleteMany({});
    
    // Hash distinct passwords
    const adminHash = await bcrypt.hash('Admin#HR#2026', 10);
    const recHash = await bcrypt.hash('Marcus#Rec#2026', 10);
    const candHash = await bcrypt.hash('Alex#Cand#2026', 10);
    const clientHash = await bcrypt.hash('Sarah#Client#2026', 10);
    
    // Seed Realistic Users
    const hrUser = await User.findOneAndUpdate(
      { email: 'hr@ambider.com' },
      { name: 'Elena Rodriguez', email: 'hr@ambider.com', passwordHash: adminHash, role: 'hr', isActive: true },
      { upsert: true, new: true }
    );
    const recruiterUser = await User.findOneAndUpdate(
      { email: 'marcus@ambider.com' },
      { name: 'Marcus Chen', email: 'marcus@ambider.com', passwordHash: recHash, role: 'recruiter', isActive: true },
      { upsert: true, new: true }
    );
    const candidateUser = await User.findOneAndUpdate(
      { email: 'alex@ambider.com' },
      { name: 'Alex Mercer', email: 'alex@ambider.com', passwordHash: candHash, role: 'candidate', isActive: true },
      { upsert: true, new: true }
    );
    const clientUser = await User.findOneAndUpdate(
      { email: 'sarah@ambider.com' },
      { name: 'Sarah Jenkins', email: 'sarah@ambider.com', passwordHash: clientHash, role: 'client', isActive: true },
      { upsert: true, new: true }
    );

    // 1. Pending HR Approval Request
    await HiringRequest.create({
      clientId: clientUser._id,
      jobTitle: 'Senior Full-Stack Engineer',
      skillsRequired: ['React', 'Node.js', 'MongoDB', 'AWS'],
      headcount: 1,
      description: 'Urgent replacement for the core infrastructure team. Must have strong distributed systems experience.',
      status: 'pending_hr_approval',
      companyName: 'Netflix',
      designation: 'Senior Engineer'
    });

    // 2. Active Request (Assigned) -> Mapped to an active Position
    const assignedRequest = await HiringRequest.create({
      clientId: clientUser._id,
      jobTitle: 'Product Manager',
      skillsRequired: ['Agile', 'Jira', 'Stakeholder Management', 'B2B SaaS'],
      headcount: 2,
      description: 'Need someone with deep enterprise SaaS experience.',
      status: 'approved',
      assignedRecruiterId: recruiterUser._id,
      companyName: 'Netflix',
      designation: 'Product Manager'
    });

    const activePosition = await Position.create({
      recruiterId: recruiterUser._id,
      hiringRequestId: assignedRequest._id,
      title: 'Product Manager',
      companyName: 'Netflix',
      openSlots: 2,
      skillsRequired: ['Agile', 'Jira', 'Stakeholder Management', 'B2B SaaS'],
      totalRounds: 3
    });

    // Add a slot for the active position
    const slot = await Availability.create({
      recruiterId: recruiterUser._id,
      positionId: activePosition._id,
      startTime: new Date(Date.now() + 86400000), // Tomorrow
      endTime: new Date(Date.now() + 90000000), // Tomorrow + 1h
      isBooked: true // Booked by Alex
    });

    // Book the slot
    await Booking.create({
      candidateId: candidateUser._id,
      recruiterId: recruiterUser._id,
      positionId: activePosition._id,
      availabilityId: slot._id,
      status: 'confirmed',
      candidateEmail: 'alex@ambider.com',
      candidateName: 'Alex Mercer',
      cvUrl: '/uploads/demo-cv.pdf',
      currentRound: 2,
      totalRounds: 3,
      roundsCleared: 1,
      roundHistory: [{ roundNumber: 1, status: 'passed' }]
    });

    // 3. Completed Pipeline Request
    const completedRequest = await HiringRequest.create({
      clientId: clientUser._id,
      jobTitle: 'UX Researcher',
      skillsRequired: ['Figma', 'User Testing', 'Wireframing'],
      headcount: 1,
      description: 'Focus on qualitative user research.',
      status: 'approved',
      assignedRecruiterId: recruiterUser._id,
      companyName: 'Netflix',
      designation: 'UX Researcher'
    });

    const completedPosition = await Position.create({
      recruiterId: recruiterUser._id,
      hiringRequestId: completedRequest._id,
      title: 'UX Researcher',
      companyName: 'Netflix',
      openSlots: 1,
      skillsRequired: ['Figma', 'User Testing', 'Wireframing'],
      totalRounds: 2
    });

    await Booking.create({
      candidateId: candidateUser._id, // Just reusing Alex for demo, or we could create a new dummy
      recruiterId: recruiterUser._id,
      positionId: completedPosition._id,
      availabilityId: slot._id, // Dummy reused slot
      status: 'selected',
      candidateEmail: 'alex@ambider.com',
      candidateName: 'Alex Mercer',
      cvUrl: '/uploads/demo-cv.pdf',
      currentRound: 2,
      totalRounds: 2,
      roundsCleared: 2,
      roundHistory: [
        { roundNumber: 1, status: 'passed' },
        { roundNumber: 2, status: 'passed' }
      ]
    });
    
    console.log('Seed successful! Realistic demo data populated in MongoDB Atlas.');
    process.exit(0);
  } catch (err) {
    console.error('Seed Error:', err);
    process.exit(1);
  }
}

seed();
