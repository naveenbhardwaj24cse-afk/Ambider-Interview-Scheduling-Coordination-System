const Position = require('../models/Position');

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    const result = await Position.updateMany(
      { totalRounds: { $exists: false } },
      { $set: { totalRounds: 1 } }
    );
    console.log(`Migration complete. Updated ${result.modifiedCount} legacy positions.`);
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

module.exports = { runMigrations };
