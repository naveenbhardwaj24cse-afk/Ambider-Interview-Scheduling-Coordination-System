const mongoose = require('mongoose');

const hiringRequestSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobTitle: { type: String, required: true },
  skillsRequired: [{ type: String }],
  headcount: { type: Number, required: true, min: 1 },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending_hr_approval', 'approved', 'rejected', 'filled'], default: 'pending_hr_approval' },
  assignedRecruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  linkedPositionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  companyName: { type: String },
  designation: { type: String },
  requesterDesignation: { type: String, required: false },
  hrRejectionReason: { type: String },
  hrApprovalNote: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('HiringRequest', hiringRequestSchema);
