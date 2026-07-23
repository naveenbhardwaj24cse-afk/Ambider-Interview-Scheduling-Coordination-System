require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

async function addAdmin() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ambider';
    console.log('Connecting to MongoDB:', mongoUri.substring(0, 40) + '...');
    await mongoose.connect(mongoUri);

    const password = 'admin@ambider.com';
    const hash = await bcrypt.hash(password, 10);

    const existing = await User.findOne({ email: 'admin@ambider.com' });
    if (existing) {
      console.log('Admin user already exists.');
    } else {
      await User.create({
        name: 'Admin HR',
        email: 'admin@ambider.com',
        passwordHash: hash,
        role: 'hr'
      });
      console.log('HR admin user created: admin@ambider.com');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error adding admin:', err);
    process.exit(1);
  }
}

addAdmin();
