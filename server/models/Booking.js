const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  candidateName: { type: String, required: true },
  candidateEmail: { type: String, required: true },
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  slotStart: { type: Date },
  slotEnd: { type: Date },
  offerExpiresAt: { type: Date },
  status: { type: String, enum: ['applied', 'confirmed', 'cancelled', 'completed', 'pending_next_round', 'selected', 'rejected', 'withdrawn', 'offer_accepted', 'offer_declined', 'pending_client_approval', 'expired'], default: 'applied' },
  clientRejectionNotes: { type: String },
  googleEventId: { type: String },
  meetLink: { type: String },
  reminded: { type: Boolean, default: false },
  totalRounds: { type: Number, required: true },
  currentRound: { type: Number, default: 1 },
  roundsCleared: { type: Number, default: 0 },
  roundHistory: [{
    round: Number,
    slotStart: Date,
    slotEnd: Date,
    status: String,
    notes: String
  }],
  interviewerAssignments: [{
    round: { type: Number, required: true },
    interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

// Add the unique compound partial index - anti-double-booking guarantee
bookingSchema.index(
  { recruiterId: 1, slotStart: 1 },
  { unique: true, partialFilterExpression: { slotStart: { $exists: true, $type: "date" } } }
);

module.exports = mongoose.model('Booking', bookingSchema);
