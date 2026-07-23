const express = require('express');
const Position = require('../models/Position');
const Availability = require('../models/Availability');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteEvent } = require('../utils/calendar');
const upload = require('../utils/upload');
const CandidateProfile = require('../models/CandidateProfile');
const { sendCancellation } = require('../utils/mailer');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['candidate']));

router.use(requireRole(['candidate']));

// CV Upload
router.post('/cv', upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const cvUrl = `/uploads/${req.file.filename}`;
    
    // Create or update profile
    let profile = await CandidateProfile.findOne({ userId: req.user.id });
    if (!profile) {
      const user = await User.findById(req.user.id);
      profile = await CandidateProfile.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        cvUrl
      });
    } else {
      profile.cvUrl = cvUrl;
      await profile.save();
    }
    
    res.json({ message: 'CV uploaded successfully', cvUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload CV', details: err.message });
  }
});

// Profile info
router.get('/profile', async (req, res) => {
  try {
    const profile = await CandidateProfile.findOne({ userId: req.user.id });
    res.json(profile || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Positions
router.get('/positions', async (req, res) => {
  try {
    const activeRecruiters = await User.find({ role: 'recruiter', isActive: true }).select('_id');
    const recruiterIds = activeRecruiters.map(r => r._id);
    const positions = await Position.find({ 
      isActive: true, 
      recruiterId: { $in: recruiterIds } 
    }).populate('recruiterId', 'name companyName');
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.get('/positions/:id/slots', async (req, res) => {
  try {
    // Only return slots that are not booked
    const slots = await Availability.find({ positionId: req.params.id, isBooked: false });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// Apply
router.post('/apply', async (req, res) => {
  try {
    const { positionId } = req.body;
    const position = await Position.findById(positionId);
    if (!position) return res.status(404).json({ error: 'Position not found' });
    
    // Check if candidate already has an active booking for this position
    const existing = await Booking.findOne({
      candidateId: req.user.id,
      positionId,
      status: { $nin: ['cancelled', 'rejected', 'withdrawn'] }
    });
    if (existing) {
      return res.status(400).json({ error: 'You have already applied or booked this position' });
    }

    const candidate = await User.findById(req.user.id);
    const recruiter = await User.findById(position.recruiterId);
    
    const booking = new Booking({
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      candidateId: candidate._id,
      recruiterId: position.recruiterId,
      positionId: position._id,
      status: 'applied',
      totalRounds: position.totalRounds || 1
    });
    await booking.save();
    
    try {
      const { sendNewApplicationNotification } = require('../utils/mailer');
      const profile = await CandidateProfile.findOne({ userId: req.user.id });
      await sendNewApplicationNotification(recruiter, candidate, booking, position, profile);
    } catch (mailErr) {
      console.error('Failed to send new application notification:', mailErr);
    }
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply' });
  }
});

// Bookings
router.post('/bookings', async (req, res) => {
  const { positionId, slotStart, slotEnd, availabilityId, existingBookingId } = req.body;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const position = await Position.findById(positionId).session(session);
    if (!position) throw new Error('POSITION_NOT_FOUND');
    
    const recruiter = await User.findById(position.recruiterId).session(session);
    if (!recruiter) throw new Error('RECRUITER_NOT_FOUND');

    const candidate = await User.findById(req.user.id).session(session);

    let oldBooking;
    if (existingBookingId) {
      oldBooking = await Booking.findOne({ _id: existingBookingId, candidateId: req.user.id }).session(session);
      if (!oldBooking) throw new Error('BOOKING_NOT_FOUND');
      
      if (oldBooking.status === 'applied') {
        throw new Error('NOT_SHORTLISTED');
      }
    }

    // Overlap Check (Candidate Double-Booking)
    const conflictingBooking = await Booking.findOne({
      candidateId: req.user.id,
      ...(existingBookingId && { _id: { $ne: existingBookingId } }),
      status: { $in: ['confirmed', 'pending_next_round'] },
      slotStart: { $lt: new Date(slotEnd) },
      slotEnd: { $gt: new Date(slotStart) }
    }).populate('positionId', 'title').session(session);

    if (conflictingBooking) {
      const error = new Error('OVERLAPPING_BOOKING');
      error.conflictingBooking = conflictingBooking;
      throw error;
    }

    // Atomically claim the availability slot
    let slot = null;
    if (availabilityId) {
      slot = await Availability.findOneAndUpdate(
        { _id: availabilityId, isBooked: false },
        { $set: { isBooked: true } },
        { new: true, session }
      );
      if (!slot) throw new Error('SLOT_TAKEN');
    }

    let booking;
    if (existingBookingId && oldBooking) {
      if (oldBooking.status === 'confirmed' && !oldBooking.slotStart) {
        // Round 1 slot booking
        booking = await Booking.findOneAndUpdate(
          { _id: existingBookingId, candidateId: req.user.id, status: 'confirmed' },
          {
            $set: {
              slotStart,
              slotEnd
            }
          },
          { new: true, session }
        );
      } else if (oldBooking.status === 'pending_next_round') {
        // Round 2+ Update
        booking = await Booking.findOneAndUpdate(
          { _id: existingBookingId, candidateId: req.user.id, status: 'pending_next_round' },
          {
            $set: {
              slotStart,
              slotEnd,
              status: 'confirmed'
            },
            $inc: { currentRound: 1 },
            $push: {
              roundHistory: {
                round: oldBooking.currentRound,
                slotStart: oldBooking.slotStart,
                slotEnd: oldBooking.slotEnd,
                status: 'passed'
              }
            }
          },
          { new: true, session }
        );
      } else {
        throw new Error('INVALID_BOOKING_STATE');
      }
    } else {
      throw new Error('MUST_APPLY_FIRST');
    }

    await session.commitTransaction();
    session.endSession();

    // Do non-transactional side-effects (calendar/email) outside the transaction lock
    try {
      booking.meetLink = `https://meet.google.com/${booking._id.toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`;
      await booking.save();
    } catch (calendarErr) {
      console.error('Failed to generate meet link:', calendarErr);
    }
    
    try {
      const { sendSlotBookingConfirmationCandidate, sendSlotBookingConfirmationRecruiter } = require('../utils/mailer');
      await sendSlotBookingConfirmationCandidate(candidate, booking, position);
      await sendSlotBookingConfirmationRecruiter(recruiter, candidate, booking, position);
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr);
    }
    
    res.json(booking);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.message === 'SLOT_TAKEN' || err.code === 11000 || err.hasErrorLabel?.('TransientTransactionError') || err.message.includes('Write conflict')) {
      return res.status(409).json({ error: 'Slot just got taken, pick another' });
    }
    if (err.message === 'POSITION_NOT_FOUND') return res.status(404).json({ error: 'Position not found' });
    if (err.message === 'RECRUITER_NOT_FOUND') return res.status(404).json({ error: 'Recruiter not found' });
    if (err.message === 'BOOKING_NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
    if (err.message === 'NOT_SHORTLISTED') return res.status(400).json({ error: 'You must be shortlisted before booking a slot' });
    
    if (err.message === 'OVERLAPPING_BOOKING') {
      const cb = err.conflictingBooking;
      const startStr = new Date(cb.slotStart).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short', year: 'numeric' });
      const endStr = new Date(cb.slotEnd).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const title = cb.positionId?.title || 'another position';
      return res.status(409).json({
        error: `You already have an interview scheduled between ${startStr} and ${endStr} for ${title}. Please choose a different time slot.`,
        conflictingPositionTitle: title,
        conflictingSlotStart: cb.slotStart,
        conflictingSlotEnd: cb.slotEnd
      });
    }
    if (err.message === 'MUST_APPLY_FIRST') return res.status(400).json({ error: 'You must apply for the position first' });
    if (err.message === 'INVALID_BOOKING_STATE') return res.status(400).json({ error: 'Booking is not in a valid state to book a slot' });
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: `Validation Error: ${err.message}` });
    }
    
    console.error('Booking Error:', err);
    res.status(500).json({ error: 'Server error creating booking', details: err.message });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({ candidateId: req.user.id })
      .populate('recruiterId', 'name')
      .populate('positionId', 'title');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, candidateId: req.user.id, status: { $ne: 'cancelled' } },
      { status: 'cancelled' },
      { new: true }
    );
    
    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, candidateId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    await deleteEvent(booking.googleEventId);
    await sendCancellation(booking);

    // Free up the availability slot based on position & start time
    await Availability.findOneAndUpdate(
      { recruiterId: booking.recruiterId, positionId: booking.positionId, specificDate: booking.slotStart },
      { isBooked: false }
    );

    res.json({ message: 'Booking cancelled' });
    } catch (err) {
      console.error('Cancellation error:', err);
      res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

router.patch('/bookings/:id/withdraw', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { 
        _id: req.params.id, 
        candidateId: req.user.id, 
        status: { $nin: ['withdrawn', 'cancelled', 'rejected', 'selected'] } 
      },
      { status: 'withdrawn' },
      { new: true }
    );
    
    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, candidateId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking is already withdrawn or in a terminal state' });
    }

    if (booking.googleEventId) {
      try {
        await deleteEvent(booking.googleEventId);
      } catch (calErr) {
        console.error('Failed to delete calendar event for candidate withdraw:', calErr.message);
      }
    }

    if (booking.status === 'confirmed' || booking.status === 'withdrawn') {
      // Free up the availability slot if they held one
      await Availability.findOneAndUpdate(
        { recruiterId: booking.recruiterId, positionId: booking.positionId, specificDate: booking.slotStart },
        { isBooked: false }
      );
    }
    
    try {
      const { sendCandidateWithdrawalNotification } = require('../utils/mailer');
      await sendCandidateWithdrawalNotification(booking);
    } catch (mailErr) {
      console.error('Failed to send withdrawal notification:', mailErr);
    }

    res.json({ message: 'Application withdrawn successfully' });
  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ error: 'Failed to withdraw application' });
  }
});

router.patch('/bookings/:id/accept-offer', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { 
        _id: req.params.id, 
        candidateId: req.user.id, 
        status: 'selected' 
      },
      { status: 'offer_accepted' },
      { new: true }
    );

    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, candidateId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking is not in a selected state to accept offer' });
    }

    // Decrement openSlots of the associated Position
    if (booking.positionId) {
      try {
        const position = await Position.findByIdAndUpdate(
          booking.positionId,
          { $inc: { openSlots: -1 } },
          { new: true }
        );
        if (position && position.openSlots <= 0) {
          position.isActive = false;
          await position.save();
        }
      } catch (posErr) {
        console.error('Failed to update Position slots on offer accept:', posErr.message);
      }
    }

    // Trigger emails
    try {
      const { sendOfferAcceptedNotification } = require('../utils/mailer');
      await sendOfferAcceptedNotification(booking);
    } catch (mailErr) {
      console.error('Failed to send offer accept notification email:', mailErr.message);
    }

    res.json({ message: 'Offer accepted successfully', booking });
  } catch (err) {
    console.error('Accept offer error:', err);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

router.patch('/bookings/:id/decline-offer', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { 
        _id: req.params.id, 
        candidateId: req.user.id, 
        status: 'selected' 
      },
      { status: 'offer_declined' },
      { new: true }
    );

    if (!booking) {
      const exists = await Booking.exists({ _id: req.params.id, candidateId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Booking not found' });
      return res.status(400).json({ error: 'Booking is not in a selected state to decline offer' });
    }

    // Trigger emails
    try {
      const { sendOfferDeclinedNotification } = require('../utils/mailer');
      await sendOfferDeclinedNotification(booking);
    } catch (mailErr) {
      console.error('Failed to send offer decline notification email:', mailErr.message);
    }

    res.json({ message: 'Offer declined successfully', booking });
  } catch (err) {
    console.error('Decline offer error:', err);
    res.status(500).json({ error: 'Failed to decline offer' });
  }
});

module.exports = router;
