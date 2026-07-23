const express = require('express');
const Position = require('../models/Position');
const Availability = require('../models/Availability');
const Booking = require('../models/Booking');
const CandidateProfile = require('../models/CandidateProfile');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteEvent } = require('../utils/calendar');
const { sendCancellation, sendNextRoundInvite, sendWithdrawal } = require('../utils/mailer');
const HiringRequest = require('../models/HiringRequest');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['recruiter']));

// Positions
router.post('/positions', async (req, res) => {
  try {
    const { title, companyName, totalRounds, hiringRequestId, openSlots, ...rest } = req.body;
    const existing = await Position.findOne({ title, companyName, recruiterId: req.user.id });
    if (existing) {
      return res.status(409).json({ error: 'A position with this title and company already exists' });
    }
    const position = await Position.create({ 
      title, companyName, totalRounds, openSlots, ...rest, 
      recruiterId: req.user.id,
      linkedHiringRequestId: hiringRequestId || undefined
    });
    
    if (hiringRequestId) {
      await HiringRequest.findByIdAndUpdate(hiringRequestId, { linkedPositionId: position._id });
    }
    
    res.json(position);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create position' });
  }
});

router.get('/hiring-requests', async (req, res) => {
  try {
    const requests = await HiringRequest.find({ assignedRecruiterId: req.user.id })
      .populate('clientId', 'companyName')
      .populate('linkedPositionId', 'title')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hiring requests' });
  }
});

router.get('/positions', async (req, res) => {
  try {
    const positions = await Position.find({ recruiterId: req.user.id });
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Availability
router.post('/availability', async (req, res) => {
  try {
    const { positionId, startTime, endTime, specificDate } = req.body;
    const slot = await Availability.create({ 
      positionId, startTime, endTime, specificDate,
      recruiterId: req.user.id,
      isRecurring: false 
    });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create availability', details: err.message });
  }
});

router.get('/availability/:positionId', async (req, res) => {
  try {
    const slots = await Availability.find({ recruiterId: req.user.id, positionId: req.params.positionId });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Bookings
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [
        { recruiterId: req.user.id },
        { 'interviewerAssignments.interviewerId': req.user.id }
      ]
    })
      .populate('candidateId', 'name email')
      .populate('positionId', 'title companyName')
      .lean();

    // Mark assigned bookings
    bookings.forEach(b => {
      if (b.interviewerAssignments && b.interviewerAssignments.some(a => a.interviewerId && a.interviewerId.toString() === req.user.id)) {
        b.isAssignedInterviewer = true;
      }
    });

    // Enrich 'applied' bookings with candidate CV URL
    const appliedBookings = bookings.filter(b => b.status === 'applied' && b.candidateId?._id);
    if (appliedBookings.length > 0) {
      const candidateIds = appliedBookings.map(b => b.candidateId._id);
      const profiles = await CandidateProfile.find({
        userId: { $in: candidateIds }
      }).select('userId cvUrl').lean();

      bookings.forEach(b => {
        if (b.status === 'applied' && b.candidateId?._id) {
          const profile = profiles.find(p => p.userId.toString() === b.candidateId._id.toString());
          b.cvUrl = profile?.cvUrl || null;
        }
      });
    }

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, recruiterId: req.user.id, status: { $ne: 'cancelled' } },
      { status: 'cancelled' },
      { new: true }
    );
    
    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, recruiterId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    await deleteEvent(booking.googleEventId);
    await sendCancellation(booking);

    // Free up the availability slot
    await Availability.findOneAndUpdate(
      { recruiterId: booking.recruiterId, positionId: booking.positionId, specificDate: booking.slotStart },
      { isBooked: false }
    );

    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

router.patch('/bookings/:id/outcome', async (req, res) => {
  try {
    const { outcome, notes } = req.body; // 'passed' or 'rejected'
    const booking = await Booking.findOne({ _id: req.params.id, recruiterId: req.user.id });
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      return res.status(400).json({ error: 'Booking is not in a state to be evaluated' });
    }

    if (outcome === 'rejected') {
      booking.status = 'rejected';
      booking.roundHistory.push({
        round: booking.currentRound,
        slotStart: booking.slotStart,
        slotEnd: booking.slotEnd,
        status: 'rejected',
        notes: notes || ''
      });
      await booking.save();
      
      try {
        const User = require('../models/User');
        const Position = require('../models/Position');
        const candidate = await User.findById(booking.candidateId);
        const recruiter = await User.findById(booking.recruiterId);
        const position = await Position.findById(booking.positionId);
        const { sendRoundResultNotification } = require('../utils/mailer');
        await sendRoundResultNotification(recruiter, candidate, booking, position, false);
      } catch (err) {
        console.error('Failed to send outcome notification:', err);
      }
      
      return res.json(booking);
    }

    if (outcome === 'passed') {
      booking.roundHistory.push({
        round: booking.currentRound,
        slotStart: booking.slotStart,
        slotEnd: booking.slotEnd,
        status: 'passed',
        notes: notes || ''
      });
      booking.roundsCleared += 1;
      
      if (booking.roundsCleared >= booking.totalRounds) {
        booking.status = 'pending_client_approval';
      } else {
        booking.status = 'pending_next_round';
      }
      
      await booking.save();
      
      try {
        const User = require('../models/User');
        const Position = require('../models/Position');
        const candidate = await User.findById(booking.candidateId);
        const recruiter = await User.findById(booking.recruiterId);
        const position = await Position.findById(booking.positionId);
        
        const { sendPendingClientApprovalNotification, sendRoundPassedNotification, sendRoundResultNotification } = require('../utils/mailer');
        
        await sendRoundResultNotification(recruiter, candidate, booking, position, true);
        
        if (booking.status === 'pending_client_approval') {
          await sendPendingClientApprovalNotification(candidate, booking, position);
        } else if (booking.status === 'pending_next_round') {
          await sendRoundPassedNotification(candidate, booking, position);
        }
      } catch (emailErr) {
        console.error('Failed to send outcome emails:', emailErr);
      }
      
      return res.json(booking);
    }
    
    res.status(400).json({ error: 'Invalid outcome' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit outcome' });
  }
});

router.patch('/bookings/:id/withdraw', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, recruiterId: req.user.id, status: { $nin: ['cancelled', 'rejected', 'withdrawn', 'selected'] } },
      { status: 'withdrawn' },
      { new: true }
    );
    
    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, recruiterId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking cannot be withdrawn in its current state' });
    }

    await deleteEvent(booking.googleEventId);
    
    // Explicit withdrawal email instead of generic cancellation
    try {
      await sendWithdrawal(booking);
    } catch (mailErr) {
      console.error('Failed to send withdrawal email:', mailErr);
    }

    // Free up the availability slot
    await Availability.findOneAndUpdate(
      { recruiterId: booking.recruiterId, positionId: booking.positionId, specificDate: booking.slotStart },
      { isBooked: false }
    );

    res.json({ message: 'Candidate withdrawn' });
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Failed to withdraw candidate' });
  }
});

router.patch('/bookings/:id/shortlist', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, recruiterId: req.user.id, status: 'applied' },
      { status: 'confirmed' },
      { new: true }
    );
    
    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, recruiterId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking is already shortlisted or not in applied state' });
    }

    try {
      const { sendShortlistNotification } = require('../utils/mailer');
      const User = require('../models/User');
      const Position = require('../models/Position');
      const candidate = await User.findById(booking.candidateId);
      const position = await Position.findById(booking.positionId);
      await sendShortlistNotification(candidate, booking, position);
    } catch (err) {
      console.error('Failed to send shortlist email:', err);
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to shortlist candidate' });
  }
});

router.patch('/bookings/:id/reject-applied', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, recruiterId: req.user.id, status: 'applied' },
      { status: 'rejected' },
      { new: true }
    );
    
    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, recruiterId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking is not in applied state' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject candidate' });
  }
});

module.exports = router;
