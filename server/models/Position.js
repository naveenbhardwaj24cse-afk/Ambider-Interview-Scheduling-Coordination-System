const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  companyName: { type: String, required: true },
  skillsRequired: [{ type: String }],
  description: { type: String },
  openSlots: { type: Number, default: 1 },
  totalRounds: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true },
  deadline: { type: Date },
  linkedHiringRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'HiringRequest' }
}, { timestamps: true });

module.exports = mongoose.model('Position', positionSchema);
