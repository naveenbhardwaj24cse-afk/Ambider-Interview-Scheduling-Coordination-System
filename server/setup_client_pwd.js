const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User'); // assuming there's a User model

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/ambider');
  
  const pwd = await bcrypt.hash('Naman_Client_Ambider_2026!', 10);
  await mongoose.connection.db.collection('users').updateOne(
    { email: 'client@ambider.com' },
    { $set: { name: 'Acme Client', email: 'client@ambider.com', password: pwd, role: 'client', companyName: 'Acme Corp' } },
    { upsert: true }
  );
  
  console.log('Client user created via DB');
  process.exit(0);
}
run();
