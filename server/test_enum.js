const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const NotificationLog = require('./models/NotificationLog');

async function test() {
  await mongoose.connect('mongodb+srv://ambiderinterview:Naveenambider@cluster0.z2g89.mongodb.net/ambider?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const b = new Booking({
    candidateName: 'Test', candidateEmail: 'test@example.com', recruiterId: new mongoose.Types.ObjectId(), slotStart: new Date(), slotEnd: new Date(), totalRounds: 1
  });
  await b.save();

  try {
    const n = new NotificationLog({ type: 'withdrawal', recipientEmail: 'test@example.com', subject: 'Test' });
    await n.save();
    console.log('NotificationLog save SUCCESS');
  } catch(e) {
    console.error('NotificationLog save ERROR:', e.message);
  }

  process.exit(0);
}
test();
