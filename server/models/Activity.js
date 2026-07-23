const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., "Added new candidate"
  details: { type: String },                // e.g., "Neha Verma from Bengaluru"
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who did it
  userName: { type: String },               // Quick access to name (e.g., "Rahul Gupta")
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activity', activitySchema);
