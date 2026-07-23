require('dotenv').config();
const mongoose = require('mongoose');

async function fullClean() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Save admin user before wiping
  const adminUser = await db.collection('users').findOne({ email: 'admin@ambider.com' });
  if (!adminUser) {
    console.error('❌ Admin user not found! Aborting.');
    process.exit(1);
  }
  console.log('✅ Admin found:', adminUser.email);

  // Clear all collections
  const toClear = [
    'hiringrequests',
    'candidateprofiles',
    'positions',
    'bookings',
    'notificationlogs',
    'availabilities'
  ];

  for (const col of toClear) {
    const result = await db.collection(col).deleteMany({});
    console.log(`  Cleared ${col}: ${result.deletedCount} documents deleted`);
  }

  // Clear all users except admin
  const userResult = await db.collection('users').deleteMany({ email: { $ne: 'admin@ambider.com' } });
  console.log(`  Cleared users (non-admin): ${userResult.deletedCount} deleted`);

  // Verify
  const userCount = await db.collection('users').countDocuments();
  const adminStillThere = await db.collection('users').findOne({ email: 'admin@ambider.com' });
  console.log(`\n✅ Total users remaining: ${userCount}`);
  console.log(`✅ Admin account: ${adminStillThere ? 'EXISTS' : '❌ MISSING'}`);
  console.log('\nDatabase is clean. Only admin@ambider.com remains.');
  process.exit(0);
}

fullClean().catch(err => { console.error('Error:', err); process.exit(1); });
