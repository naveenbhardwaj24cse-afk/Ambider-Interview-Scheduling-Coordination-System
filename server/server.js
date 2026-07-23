require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { startCronJobs } = require('./utils/cronJobs');
const { runMigrations } = require('./utils/migrate');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const recruiterRoutes = require('./routes/recruiter');
const candidateRoutes = require('./routes/candidate');
const clientRoutes = require('./routes/client');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Echo the origin back to allow any Vercel URL dynamically
    callback(null, origin || true);
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recruiter', recruiterRoutes);
app.use('/api/candidate', candidateRoutes);
app.use('/api/client', clientRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ambider')
  .then(async () => {
    console.log('Connected to MongoDB');
    await runMigrations(); // Run migrations after DB connect
    startCronJobs();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

