require('dotenv').config();
const mongoose = require('mongoose');
const HiringRequest = require('./models/HiringRequest');

(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ambider';
  await mongoose.connect(mongoUri);
  const pending = await HiringRequest.find({ $or: [{ assignedRecruiterId: null }, { assignedRecruiterId: { $exists: false } }] });
  console.log('pending count', pending.length);
  await mongoose.disconnect();
})();
