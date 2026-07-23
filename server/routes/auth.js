const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CandidateProfile = require('../models/CandidateProfile');
const Position = require('../models/Position');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/positions', async (req, res) => {
  try {
    const positions = await Position.find({ isActive: true }).select('title companyName');
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, linkedIn, skillsLearned, interestedPosition } = req.body;
    
    if (role === 'hr') {
      return res.status(403).json({ error: 'HR accounts cannot be created publicly.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash: hash, role });

    if (role === 'candidate') {
      await CandidateProfile.create({
        userId: user._id,
        name,
        email,
        phone,
        linkedIn,
        skillsLearned: skillsLearned || [],
        interestedPosition
      });
    }

    res.json({ id: user._id, message: 'Registration successful' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error during registration', details: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive) return res.status(401).json({ error: 'Account is deactivated' });
    
    const valid = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
