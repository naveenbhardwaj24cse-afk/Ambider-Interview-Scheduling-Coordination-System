const ics = require('ics');

function generateICS(booking, candidate, position, recruiter) {
  if (!booking.slotStart || !booking.slotEnd) {
    return null;
  }
  
  const start = new Date(booking.slotStart);
  const end = new Date(booking.slotEnd);
  
  const event = {
    start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()],
    end: [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes()],
    startInputType: 'utc',
    title: `Interview: ${position.title} at ${position.companyName || 'the company'} - Round ${booking.currentRound}`,
    description: `Round ${booking.currentRound} of ${booking.totalRounds}\nPosition: ${position.title}\nCompany: ${position.companyName || 'the company'}\n\nJoin here: ${booking.meetLink || 'Link to follow'}`,
    location: booking.meetLink || 'Online',
    status: 'CONFIRMED',
    organizer: { name: recruiter.name, email: recruiter.email },
    attendees: [
      { name: candidate.name, email: candidate.email, rsvp: true }
    ]
  };

  const { error, value } = ics.createEvent(event);
  if (error) {
    console.error('Failed to generate ICS:', error);
    return null;
  }
  return value;
}

module.exports = { generateICS };
