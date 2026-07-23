const express = require('express');
const HiringRequest = require('../models/HiringRequest');
const Booking = require('../models/Booking');
const { getFilledCount } = require('../utils/bookingHelper');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['client']));

// Create a new hiring request
router.post('/hiring-requests', async (req, res) => {
  try {
    const { jobTitle, requesterDesignation, skillsRequired, headcount, description, companyName, designation } = req.body;
    const request = await HiringRequest.create({
      clientId: req.user.id,
      jobTitle,
      requesterDesignation,
      skillsRequired: Array.isArray(skillsRequired) ? skillsRequired : skillsRequired.split(',').map(s => s.trim()),
      headcount,
      description,
      companyName,
      designation,
      status: 'pending_hr_approval'
    });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create hiring request' });
  }
});

// Resubmit a rejected hiring request
router.patch('/hiring-requests/:id/resubmit', async (req, res) => {
  try {
    const { jobTitle, requesterDesignation, skillsRequired, headcount, description } = req.body;
    const request = await HiringRequest.findOne({ _id: req.params.id, clientId: req.user.id });

    if (!request) {
      return res.status(404).json({ error: 'Hiring request not found' });
    }
    
    if (request.status !== 'rejected') {
      return res.status(400).json({ error: 'Only rejected requests can be resubmitted' });
    }

    if (jobTitle) request.jobTitle = jobTitle;
    if (requesterDesignation) request.requesterDesignation = requesterDesignation;
    if (skillsRequired) {
      request.skillsRequired = Array.isArray(skillsRequired) ? skillsRequired : skillsRequired.split(',').map(s => s.trim());
    }
    if (headcount) request.headcount = headcount;
    if (description) request.description = description;

    request.status = 'pending_hr_approval';
    request.hrRejectionReason = undefined;
    request.hrApprovalNote = undefined;
    
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resubmit hiring request' });
  }
});

// View own hiring requests
router.get('/hiring-requests', async (req, res) => {
  try {
    const requests = await HiringRequest.find({ clientId: req.user.id })
      .populate('linkedPositionId')
      .sort({ createdAt: -1 })
      .lean();

    for (let r of requests) {
      if (r.linkedPositionId) {
        const bookings = await Booking.find({ positionId: r.linkedPositionId._id })
          .populate('candidateId', 'name')
          .lean();
        const filledCount = await getFilledCount(bookings);
        r.filledCount = filledCount;
        r.bookings = bookings;

        const breakdown = {
          round1: bookings.filter(b => b.status === 'confirmed' && b.currentRound === 1).length,
          round2: bookings.filter(b => b.status === 'confirmed' && b.currentRound === 2).length,
          round3Plus: bookings.filter(b => b.status === 'confirmed' && b.currentRound >= 3).length,
          pendingNext: bookings.filter(b => b.status === 'pending_next_round').length,
          selected: bookings.filter(b => b.status === 'selected').length,
          offerAccepted: bookings.filter(b => b.status === 'offer_accepted').length,
          offerDeclined: bookings.filter(b => b.status === 'offer_declined').length,
          rejected: bookings.filter(b => b.status === 'rejected').length
        };
        r.breakdown = breakdown;
      } else {
        r.filledCount = 0;
        r.breakdown = null;
        r.bookings = [];
      }
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hiring requests' });
  }
});

// Fetch bookings awaiting client approval
router.get('/bookings/pending-approval', async (req, res) => {
  try {
    const requests = await HiringRequest.find({ clientId: req.user.id }).lean();
    const positionIds = requests.map(r => r.linkedPositionId).filter(Boolean);
    
    const bookings = await Booking.find({
      positionId: { $in: positionIds },
      status: 'pending_client_approval'
    })
    .populate('positionId', 'title')
    .populate('recruiterId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending approval bookings' });
  }
});

// Approve a selection and extend offer
router.patch('/bookings/:id/approve-selection', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'positionId',
        populate: { path: 'linkedHiringRequestId' }
      });
      
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const hiringRequest = booking.positionId?.linkedHiringRequestId;
    if (!hiringRequest || hiringRequest.clientId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this request' });
    }
    
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'pending_client_approval'
      },
      {
        $set: { 
          status: 'selected',
          offerExpiresAt: new Date(Date.now() + (parseInt(process.env.OFFER_EXPIRY_HOURS) || 168) * 60 * 60 * 1000)
        }
      },
      { returnDocument: 'after' }
    );
    
    if (!updatedBooking) {
      return res.status(400).json({ error: 'Booking is not pending client approval or was already processed' });
    }
    
    try {
      const { sendOfferExtendedNotification } = require('../utils/mailer');
      const User = require('../models/User');
      const Position = require('../models/Position');
      const candidate = await User.findById(updatedBooking.candidateId);
      const position = await Position.findById(updatedBooking.positionId);
      await sendOfferExtendedNotification(candidate, updatedBooking, position);
    } catch (emailErr) {
      console.error('Failed to send offer extended email:', emailErr);
    }
    
    res.json(updatedBooking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve selection' });
  }
});

// Reject a selection
router.patch('/bookings/:id/reject-selection', async (req, res) => {
  try {
    const { notes } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'positionId',
        populate: { path: 'linkedHiringRequestId' }
      });
      
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const hiringRequest = booking.positionId?.linkedHiringRequestId;
    if (!hiringRequest || hiringRequest.clientId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this request' });
    }
    
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'pending_client_approval'
      },
      {
        $set: { 
          status: 'rejected',
          clientRejectionNotes: notes || ''
        }
      },
      { returnDocument: 'after' }
    );
    
    if (!updatedBooking) {
      return res.status(400).json({ error: 'Booking is not pending client approval or was already processed' });
    }
    
    try {
      const { sendClientRejectionNotification } = require('../utils/mailer');
      await sendClientRejectionNotification(updatedBooking);
    } catch (emailErr) {
      console.error('Failed to send client rejection email:', emailErr);
    }
    
    res.json(updatedBooking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject selection' });
  }
});

module.exports = router;
