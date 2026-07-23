const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET
);

oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

async function createEvent(booking, interviewerEmail) {
  try {
    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Interview: ${booking.candidateName}`,
        start: { dateTime: new Date(booking.slotStart).toISOString() },
        end: { dateTime: new Date(booking.slotEnd).toISOString() },
        attendees: [{ email: booking.candidateEmail }, { email: interviewerEmail }],
        conferenceData: {
          createRequest: {
            requestId: booking._id ? booking._id.toString() : `req-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      },
    });
    return { eventId: event.data.id, meetLink: event.data.hangoutLink };
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw error;
  }
}
async function deleteEvent(eventId) {
  try {
    if (!eventId) return;
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
  }
}

module.exports = { createEvent, deleteEvent };
