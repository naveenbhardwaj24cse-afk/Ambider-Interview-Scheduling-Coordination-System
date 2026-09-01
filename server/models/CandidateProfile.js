const mongoose = require('mongoose');

const candidateProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  linkedIn: { type: String },
  skillsLearned: [{ type: String }],
  interestedPosition: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  status: { 
    type: String, 
    enum: ['Applied', 'Screening', 'Interviewing', 'Offered', 'Rejected'],
    enum: ['Applied', 'Screening', 'Interviewing', 'Offered', 'Rejected'],
    default: 'Applied'
  },
  cvUrl: { type: String },
  cvFile: {
    data: Buffer,
    contentType: String,
    filename: String
  }
}, { timestamps: true });

module.exports = mongoose.model('CandidateProfile', candidateProfileSchema);
