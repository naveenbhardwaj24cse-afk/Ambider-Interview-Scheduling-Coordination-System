const cron = require('node-cron');
const Booking = require('../models/Booking');
const { sendReminder } = require('./mailer');

function startCronJobs() {
  // Run every hour at the top of the hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running 24-hour reminder check...');
    try {
      const now = new Date();
      const tomorrowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000); // Check within 1 hr window

      // Find bookings starting between 24 and 25 hours from now, not yet reminded
      const upcomingBookings = await Booking.find({
        slotStart: { $gte: tomorrowStart, $lt: tomorrowEnd },
        reminded: false,
        status: 'confirmed'
      });

      for (const booking of upcomingBookings) {
        await sendReminder(booking);
        booking.reminded = true;
        await booking.save();
      }
    } catch (err) {
      console.error('Error running 24-hour cron job:', err);
    }
  });

  // Run every hour to check for expired offers
  cron.schedule('0 * * * *', async () => {
    console.log('Running offer expiration check...');
    try {
      const { NotificationLog } = require('../models/NotificationLog'); // need NotificationLog here? wait, require it at the top
      // Let's just require it inline if it's not at the top to avoid circular deps if any
      const NotifLog = require('../models/NotificationLog');
      const { sendOfferExpiredNotification, sendOfferExpiredNotificationHR, sendOfferExpiredNotificationRecruiter } = require('./mailer');

      const expiredBookings = await Booking.find({
        status: 'selected',
        offerExpiresAt: { $lt: new Date() }
      }).populate('candidateId', 'name email')
        .populate('positionId', 'title companyName')
        .populate('recruiterId', 'name email');

      for (const booking of expiredBookings) {
        try {
          booking.status = 'expired';
          await booking.save();

          await NotifLog.create({ bookingId: booking._id, type: 'offer_expired', recipientEmail: booking.candidateEmail, subject: `Your offer for ${booking.positionId?.title} has expired` });

          await sendOfferExpiredNotification(booking.candidateId, booking);
          await sendOfferExpiredNotificationHR(booking);
          await sendOfferExpiredNotificationRecruiter(booking.recruiterId, booking);
        } catch (innerErr) {
          console.error(`Failed to process expiration for booking ${booking._id}:`, innerErr);
        }
      }
    } catch (err) {
      console.error('Error running offer expiration cron job:', err);
    }
  });
}

module.exports = { startCronJobs };
