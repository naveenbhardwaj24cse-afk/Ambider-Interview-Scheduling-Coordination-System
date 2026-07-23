require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const CandidateProfile = require('./models/CandidateProfile');
const Position = require('./models/Position');
const Availability = require('./models/Availability');
const Booking = require('./models/Booking');
const NotificationLog = require('./models/NotificationLog');
const HiringRequest = require('./models/HiringRequest');

async function clearDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ambider';
    console.log('Connecting to MongoDB:', mongoUri.substring(0, 40) + '...');
    await mongoose.connect(mongoUri);
    
    console.log('Clearing all data from database...');
    await User.deleteMany({});
    await CandidateProfile.deleteMany({});
    await Position.deleteMany({});
    await Availability.deleteMany({});
    await Booking.deleteMany({});
    await NotificationLog.deleteMany({});
    await HiringRequest.deleteMany({});
    
    console.log('Database successfully cleared of all test credentials and details.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clearDB();
