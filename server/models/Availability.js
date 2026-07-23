const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
  dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday, 1 = Monday, etc.
  startTime: { type: String, required: true }, // e.g. "09:00"
  endTime: { type: String, required: true },   // e.g. "17:00"
  isRecurring: { type: Boolean, default: true },
  specificDate: { type: Date }, // Use if not recurring
  isBooked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Availability', availabilitySchema);
