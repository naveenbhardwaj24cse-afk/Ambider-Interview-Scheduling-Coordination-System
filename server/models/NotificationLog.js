const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'confirmation',
      'reminder',
      'cancellation',
      'next_round',
      'withdrawal',
      'selected_notification',
      'offer_accepted_notification',
      'offer_declined_notification',
      'offer_extended_notification',
      'offer_expired',
      'offer_reextended',
      'shortlist_notification',
      'slot_booking_candidate',
      'slot_booking_recruiter',
      'round_passed',
      'pending_client_approval',
      'new_application',
      'round_result',
      'hr_request_approved',
      'hr_request_rejected',
      'interviewer_assigned',
      'client_rejection',
      'other',
      'credentials_sent'
    ],
    required: true
  },
  recipientEmail: { type: String, required: true },
  subject: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  relatedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
}, { timestamps: true });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
