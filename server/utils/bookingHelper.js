const Booking = require('../models/Booking');

/**
 * Calculates the filled count for a position based on the unified rule:
 * status is 'selected' (offer extended) or 'offer_accepted' (offer accepted).
 * 
 * Can accept a mongoose ObjectId/string `positionId` OR a preloaded array of bookings.
 */
async function getFilledCount(positionIdOrBookings) {
  if (Array.isArray(positionIdOrBookings)) {
    return positionIdOrBookings.filter(b => b.status === 'selected' || b.status === 'offer_accepted').length;
  }
  if (!positionIdOrBookings) return 0;
  return await Booking.countDocuments({
    positionId: positionIdOrBookings,
    status: { $in: ['selected', 'offer_accepted'] }
  });
}

module.exports = {
  getFilledCount
};
