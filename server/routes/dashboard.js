const express = require('express');
const Candidate = require('../models/Candidate');
const Booking = require('../models/Booking');
const Activity = require('../models/Activity');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Get dashboard stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const totalCandidates = await Candidate.countDocuments();
    const confirmedInterviews = await Booking.countDocuments({ status: 'confirmed' });
    const completedInterviews = await Booking.countDocuments({ status: 'completed' });
    const pendingReview = await Candidate.countDocuments({ status: 'Screening' });

    // Aggregate booking statuses for the colorful bar
    const bookings = await Booking.find();
    let statuses = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      rescheduled: 0,
      rejected: 0,
      noShow: 0
    };
    
    bookings.forEach(b => {
      // mapping our simple statuses to the complex UI ones. 
      // For now, map everything to what we have.
      if (b.status === 'confirmed') statuses.confirmed++;
      else if (b.status === 'cancelled') statuses.rejected++;
      else statuses.pending++; // default fallback
    });

    // Upcoming Interviews
    const upcomingInterviews = await Booking.find({ 
      slotStart: { $gte: new Date() },
      status: 'confirmed'
    }).sort({ slotStart: 1 }).limit(5);

    // Recent Activity
    const recentActivity = await Activity.find().sort({ createdAt: -1 }).limit(5);

    res.json({
      metrics: {
        totalCandidates,
        confirmedInterviews,
        completedInterviews,
        pendingReview
      },
      statuses,
      upcomingInterviews,
      recentActivity
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
