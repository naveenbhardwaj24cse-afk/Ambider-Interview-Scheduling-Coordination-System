const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Booking = require('../models/Booking');
const HiringRequest = require('../models/HiringRequest');
const NotificationLog = require('../models/NotificationLog');
const CandidateProfile = require('../models/CandidateProfile');
const Position = require('../models/Position');
const { getFilledCount } = require('../utils/bookingHelper');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendCredentialsNotification } = require('../utils/mailer');
const upload = require('../utils/upload');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['hr']));

// Users Management
router.get('/users', async (req, res) => {
  try {
    // Return all recruiters and clients
    const users = await User.find({ role: { $in: ['recruiter', 'candidate'] } }).select('-passwordHash').lean();
    
    // Attach CV URLs for candidates
    for (let u of users) {
      if (u.role === 'candidate') {
        const profile = await CandidateProfile.findOne({ userId: u._id });
        if (profile) u.cvUrl = profile.cvUrl;
      }
    }
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/staff', async (req, res) => {
  try {
    const staff = await User.find({
      role: { $in: ['hr', 'recruiter'] },
      isActive: true
    }).select('_id name email role').lean();
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

router.post('/users', upload.single('cv'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash: hash, role });
    
    if (role === 'candidate' && req.file) {
      const safeFilename = Date.now() + '-' + req.file.originalname.replace(/\s+/g, '_');
      await CandidateProfile.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        cvUrl: `/uploads/${safeFilename}`,
        cvFile: {
          data: req.file.buffer,
          contentType: req.file.mimetype,
          filename: safeFilename
        }
      });
    }
    
    // Send credentials notification
    await sendCredentialsNotification(name, email, password, role);

    res.json({ id: user._id, message: 'User created' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
});

router.patch('/users/:id/deactivate', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false },
      { new: true }
    );
    
    if (!user) {
      const exists = await User.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: 'User not found' });
      return res.status(400).json({ error: 'User is already deactivated' });
    }
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await User.findByIdAndDelete(req.params.id);
    if (user.role === 'candidate') {
      await CandidateProfile.findOneAndDelete({ userId: req.params.id });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Bookings
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('recruiterId', 'name email')
      .populate('candidateId', 'name email')
      .populate('positionId', 'title')
      .lean();
      
    // Mark assigned bookings
    bookings.forEach(b => {
      if (b.interviewerAssignments && b.interviewerAssignments.some(a => a.interviewerId && a.interviewerId.toString() === req.user.id)) {
        b.isAssignedInterviewer = true;
      }
    });
      
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.get('/bookings/export', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('recruiterId', 'name')
      .populate('candidateId', 'name')
      .populate('positionId', 'title');
    
    let csv = 'Candidate Name,Candidate Email,Recruiter,Position,Slot Start,Slot End,Status\n';
    bookings.forEach(b => {
      csv += `"${b.candidateName}","${b.candidateEmail}","${b.recruiterId?.name || ''}","${b.positionId?.title || ''}","${b.slotStart}","${b.slotEnd}","${b.status}"\n`;
    });
    
    res.header('Content-Type', 'text/csv');
    res.attachment('bookings.csv');
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export bookings' });
  }
});

router.patch('/bookings/:id/re-extend-offer', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('candidateId', 'name email')
      .populate('positionId', 'title companyName')
      .populate('recruiterId', 'name email');
      
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    if (booking.status !== 'expired') {
      return res.status(400).json({ error: 'Only expired offers can be re-extended' });
    }
    
    booking.status = 'selected';
    booking.offerExpiresAt = new Date(Date.now() + (parseInt(process.env.OFFER_EXPIRY_HOURS) || 168) * 60 * 60 * 1000);
    await booking.save();
    
    try {
      const candidateUser = await User.findById(booking.candidateId);
      const { sendOfferReExtendedNotification } = require('../utils/mailer');
      await sendOfferReExtendedNotification(candidateUser, booking);
      await NotificationLog.create({ bookingId: booking._id, type: 'offer_reextended', recipientEmail: booking.candidateEmail, subject: `Your offer for ${booking.positionId?.title} has been reinstated` });
    } catch (emailErr) {
      console.error('Failed to send re-extend email:', emailErr);
    }
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to re-extend offer' });
  }
});

// Notifications
router.get('/notifications', async (req, res) => {
  try {
    const logs = await NotificationLog.find().sort({ sentAt: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Hiring Requests Management
router.get('/hiring-requests', async (req, res) => {
  try {
    const requests = await HiringRequest.find()
      .populate('clientId', 'name email companyName')
      .populate('assignedRecruiterId', 'name email')
      .populate('linkedPositionId', 'title')
      .sort({ createdAt: -1 })
      .lean();
      
    for (let req of requests) {
      if (req.linkedPositionId) {
        req.selectedCount = await getFilledCount(req.linkedPositionId._id);
      } else {
        req.selectedCount = 0;
      }
      // Also fetch inactive positions that were previously linked
      const inactivePositions = await Position.find({ linkedHiringRequestId: req._id, isActive: false }, 'title');
      req.inactivePositions = inactivePositions;
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hiring requests' });
  }
});

router.patch('/hiring-requests/:id/assign', async (req, res) => {
  try {
    const { recruiterId } = req.body;
    const hrRequest = await HiringRequest.findById(req.params.id);
    if (!hrRequest) return res.status(404).json({ error: 'Hiring request not found' });
    
    if (hrRequest.linkedPositionId) {
      return res.status(400).json({ error: 'Cannot reassign a request that is already linked to an active Position.' });
    }
    if (hrRequest.status !== 'approved' && hrRequest.status !== 'filled') {
      return res.status(400).json({ error: 'Cannot assign recruiter unless the request is approved.' });
    }
    
    hrRequest.assignedRecruiterId = recruiterId;
    await hrRequest.save();
    res.json(hrRequest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign recruiter' });
  }
});

router.patch('/hiring-requests/:id/reassign', async (req, res) => {
  try {
    const { recruiterId } = req.body;
    const hrRequest = await HiringRequest.findById(req.params.id);
    if (!hrRequest) return res.status(404).json({ error: 'Hiring request not found' });
    
    if (hrRequest.status !== 'approved' && hrRequest.status !== 'filled') {
      return res.status(400).json({ error: 'Cannot reassign recruiter unless the request is approved.' });
    }
    
    // 1. Deactivate old position if it exists
    if (hrRequest.linkedPositionId) {
      await Position.findByIdAndUpdate(hrRequest.linkedPositionId, { isActive: false });
    }
    
    // 2. Clear linkedPositionId and update recruiter
    hrRequest.linkedPositionId = null;
    hrRequest.assignedRecruiterId = recruiterId;
    await hrRequest.save();
    
    res.json(hrRequest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reassign recruiter' });
  }
});

router.get('/dashboard-alerts', async (req, res) => {
  try {
    const pendingRequests = await HiringRequest.find({ status: 'pending_hr_approval' })
      .populate('clientId', 'companyName')
      .lean();
      
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    
    const staleBookings = await Booking.find({
      status: { $in: ['confirmed', 'pending_next_round', 'pending_client_approval'] },
      updatedAt: { $lt: fiveDaysAgo }
    }).populate('candidateId', 'name').populate('positionId', 'title').lean();
    
    const overduePositions = await Position.find({
      isActive: true,
      openSlots: { $gt: 0 },
      deadline: { $lt: new Date() }
    }).lean();
    
    res.json({
      pendingRequests,
      staleBookings,
      overduePositions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard alerts' });
  }
});

router.patch('/hiring-requests/:id/approve', async (req, res) => {
  try {
    const { note } = req.body;
    const request = await HiringRequest.findOne({ _id: req.params.id, status: 'pending_hr_approval' }).populate('clientId', 'name email companyName');
    
    if (!request) {
      return res.status(400).json({ error: 'Request not found or not in pending state' });
    }
    
    request.status = 'approved';
    if (note) request.hrApprovalNote = note;
    await request.save();
    
    try {
      const clientUser = await User.findById(request.clientId);
      const { sendHRRequestApprovalNotification } = require('../utils/mailer');
      await sendHRRequestApprovalNotification(clientUser, request);
    } catch (mailErr) {
      console.error('Failed to send HR approval notification:', mailErr);
    }
    
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.patch('/hiring-requests/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await HiringRequest.findOne({ _id: req.params.id, status: 'pending_hr_approval' }).populate('clientId', 'name email companyName');
    
    if (!request) {
      return res.status(400).json({ error: 'Request not found or not in pending state' });
    }
    
    request.status = 'rejected';
    if (reason) request.hrRejectionReason = reason;
    await request.save();
    
    try {
      const clientUser = await User.findById(request.clientId);
      const { sendHRRequestRejectionNotification } = require('../utils/mailer');
      await sendHRRequestRejectionNotification(clientUser, request);
    } catch (mailErr) {
      console.error('Failed to send HR rejection notification:', mailErr);
    }
    
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

router.patch('/hiring-requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending_hr_approval', 'approved', 'rejected', 'filled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const request = await HiringRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'Hiring request not found' });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update hiring request status' });
  }
});

router.patch('/bookings/:id/assign-interviewer', async (req, res) => {
  try {
    const { round, interviewerId } = req.body;
    
    // Validate interviewer
    const interviewer = await User.findOne({
      _id: interviewerId,
      role: { $in: ['hr', 'recruiter'] },
      isActive: true
    });
    
    if (!interviewer) {
      return res.status(400).json({ error: 'Invalid interviewer or user is not active staff' });
    }
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Remove existing assignment for this round, if any
    booking.interviewerAssignments = booking.interviewerAssignments.filter(a => a.round !== round);
    
    // Push new assignment
    booking.interviewerAssignments.push({ round, interviewerId });
    
    await booking.save();
    
    try {
      const { sendInterviewerAssignmentNotification } = require('../utils/mailer');
      await sendInterviewerAssignmentNotification(interviewer, booking, round);
    } catch (err) {
      console.error('Failed to send interviewer assignment email:', err);
    }
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign interviewer' });
  }
});

module.exports = router;
