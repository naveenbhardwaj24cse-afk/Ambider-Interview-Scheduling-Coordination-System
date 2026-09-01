const nodemailer = require('nodemailer');
const NotificationLog = require('../models/NotificationLog');
const ics = require('ics');
const CandidateProfile = require('../models/CandidateProfile');
const path = require('path');
const fs = require('fs');

const { generateICS } = require('./calendarHelper');

async function attachCV(candidateId) {
  try {
    const CandidateProfile = require('../models/CandidateProfile');
    const profile = await CandidateProfile.findOne({ userId: candidateId });
    if (profile?.cvFile?.data) {
      return {
        filename: profile.cvFile.filename || 'Candidate_CV.pdf',
        content: Buffer.isBuffer(profile.cvFile.data) ? profile.cvFile.data : Buffer.from(profile.cvFile.data),
        contentType: profile.cvFile.contentType || 'application/pdf'
      };
    }
  } catch(e) { console.error('Error fetching CV attachment:', e); }
  return null;
}


const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: process.env.MAIL_PORT == 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) console.error('❌ Mailer config error:', error);
  else console.log('✅ Mailer ready');
});

function generateIcsString(booking, positionTitle, recruiterName) {
  const start = new Date(booking.slotStart);
  const end = new Date(booking.slotEnd);
  
  const event = {
    start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()],
    end: [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes()],
    startInputType: 'utc',
    title: `Interview: ${positionTitle} - Round ${booking.currentRound} of ${booking.totalRounds}`,
    description: `Candidate: ${booking.candidateName}\nRecruiter: ${recruiterName}\nRound: ${booking.currentRound} of ${booking.totalRounds}\nJoin here: ${booking.meetLink}`,
    status: 'CONFIRMED',
    organizer: { name: recruiterName, email: process.env.MAIL_FROM },
    attendees: [
      { name: booking.candidateName, email: booking.candidateEmail, rsvp: true }
    ]
  };

  const { error, value } = ics.createEvent(event);
  if (error) {
    console.error('Failed to generate ICS:', error);
    return null;
  }
  return value;
}


async function sendConfirmation(booking, positionTitle, recruiterName) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const icsContent = generateIcsString(booking, positionTitle, recruiterName);
    const attachments = [];
    if (icsContent) {
      attachments.push({
        filename: 'invite.ics',
        content: Buffer.from(icsContent, 'utf-8'),
        contentType: 'text/calendar'
      });
    }

    const emailText = `Hello ${booking.candidateName},\n\nYour interview is confirmed.\n\nPosition: ${positionTitle}\nRecruiter: ${recruiterName}\nRound: ${booking.currentRound} of ${booking.totalRounds}\nTime: ${new Date(booking.slotStart).toLocaleString()}\n\nJoin here: ${booking.meetLink}\n\nPlease find the calendar invite attached.`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: booking.candidateEmail,
      subject: `Interview Confirmed: ${positionTitle} - Round ${booking.currentRound} of ${booking.totalRounds}`,
      text: emailText,
      attachments
    });
    console.log(`Confirmation email sent to ${booking.candidateEmail}`);
    await NotificationLog.create({
      type: 'confirmation',
      recipientEmail: booking.candidateEmail,
      subject: `Interview Confirmed: ${positionTitle}`,
      relatedBookingId: booking._id
    });
  } catch (err) { console.error('Mailer error in sendConfirmation:', err); }
}


async function sendRecruiterNotification(recruiterEmail, candidateName, positionTitle, slotStart, slotEnd) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const icsContent = generateIcsString(booking, positionTitle, recruiterName);
    const attachments = [];
    if (icsContent) {
      attachments.push({
        filename: 'invite.ics',
        content: Buffer.from(icsContent, 'utf-8'),
        contentType: 'text/calendar'
      });
    }

    const profile = await CandidateProfile.findOne({ userId: booking.candidateId });
    if (profile?.cvFile?.data) {
      attachments.push({
        filename: profile.cvFile.filename || 'CV.pdf',
        content: Buffer.isBuffer(profile.cvFile.data) ? profile.cvFile.data : Buffer.from(profile.cvFile.data),
        contentType: profile.cvFile.contentType || 'application/pdf'
      });
    }

    const emailText = `Hello ${recruiterName},\n\nA candidate has booked an interview.\n\nCandidate: ${booking.candidateName}\nPosition: ${positionTitle}\nRound: ${booking.currentRound} of ${booking.totalRounds}\nTime: ${new Date(booking.slotStart).toLocaleString()}\n\nJoin here: ${booking.meetLink}\n\nPlease find the candidate's CV and the calendar invite attached.`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiterEmail,
      subject: `New Interview Booked: ${booking.candidateName} for ${positionTitle} (Round ${booking.currentRound})`,
      text: emailText,
      attachments
    });
    console.log(`Recruiter notification sent to ${recruiterEmail}`);
    await NotificationLog.create({
      type: 'confirmation',
      recipientEmail: recruiterEmail,
      subject: `New Interview Booked: ${booking.candidateName}`,
      relatedBookingId: booking._id
    });
  } catch (err) { console.error('Mailer error in sendRecruiterNotification:', err); }
}


async function sendReminder(booking, positionTitle) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: booking.candidateEmail,
      subject: 'Interview Reminder',
      text: `Reminder: Your interview is coming up in roughly 24 hours at ${new Date(booking.slotStart).toLocaleString()}\nJoin here: ${booking.meetLink}`
    });
    console.log(`Reminder email sent to ${booking.candidateEmail}`);
    await NotificationLog.create({
      type: 'reminder',
      recipientEmail: booking.candidateEmail,
      subject: 'Interview Reminder',
      relatedBookingId: booking._id
    });
  } catch (err) { console.error('Mailer error in sendReminder:', err); }
}


async function sendCancellation(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: booking.candidateEmail,
      subject: 'Update: Your Interview has been Cancelled',
      text: `Your interview scheduled for ${new Date(booking.slotStart).toLocaleString()} has been cancelled.`
    });
    console.log(`Cancellation email sent to ${booking.candidateEmail}`);
    await NotificationLog.create({
      type: 'cancellation',
      recipientEmail: booking.candidateEmail,
      subject: 'Interview Cancelled',
      relatedBookingId: booking._id
    });
  } catch (err) { console.error('Mailer error in sendCancellation:', err); }
}


async function sendNextRoundInvite(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const populated = await booking.populate('positionId', 'title');
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: booking.candidateEmail,
      subject: `Congratulations! Next round for ${populated.positionId?.title || 'the position'}`,
      text: `Hello ${booking.candidateName},\n\nYou passed the previous round! Please log in to your candidate dashboard to book your slot for Round ${booking.currentRound + 1}.\n\nThank you,\nAmbiDer Recruiting`
    });
    console.log(`Next round email sent to ${booking.candidateEmail}`);
    await NotificationLog.create({
      type: 'next_round',
      recipientEmail: booking.candidateEmail,
      subject: 'Next Round Booking Link',
      relatedBookingId: booking._id
    });
  } catch (err) { console.error('Mailer error in sendNextRoundInvite:', err); }
}


async function sendWithdrawal(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const populated = await booking.populate('positionId', 'title');
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: booking.candidateEmail,
      subject: `Update regarding your application for ${populated.positionId?.title || 'the position'}`,
      text: `Hello ${booking.candidateName},\n\nWe are writing to let you know that your application for ${populated.positionId?.title || 'the position'} has been withdrawn. The recruiter has chosen not to move forward at this time.\n\nThank you for your interest,\nAmbiDer Recruiting`
    });
    console.log(`Withdrawal email sent to ${booking.candidateEmail}`);
    await NotificationLog.create({
      type: 'withdrawal',
      recipientEmail: booking.candidateEmail,
      subject: 'Application Withdrawn',
      relatedBookingId: booking._id
    });
  } catch (err) { console.error('Mailer error in sendWithdrawal:', err); }
}


async function sendCandidateWithdrawalNotification(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const populated = await booking.populate(['positionId', 'recruiterId']);
    const recruiterEmail = populated.recruiterId?.email;
    if (!recruiterEmail) return;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiterEmail,
      subject: `Candidate Withdrawal: ${booking.candidateName} has withdrawn from ${populated.positionId?.title || 'the position'}`,
      text: `Hello,\n\nThe candidate ${booking.candidateName} has chosen to withdraw their application for ${populated.positionId?.title || 'the position'}.\n\nThis application is now marked as withdrawn and the candidate has dropped out of the process.\n\nThank you,\nAmbiDer System`
    });
    console.log(`Candidate withdrawal notification sent to recruiter ${recruiterEmail}`);
    await NotificationLog.create({
      type: 'withdrawal',
      recipientEmail: recruiterEmail,
      subject: 'Candidate Withdrawal Notification',
      relatedBookingId: booking._id
    });
  } catch (err) { console.error('Mailer error in sendCandidateWithdrawalNotification:', err); }
}


async function sendCandidateSelectedNotification(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const BookingModel = require('../models/Booking');
    const populated = await BookingModel.findById(booking._id)
      .populate({
        path: 'positionId',
        populate: { path: 'linkedHiringRequestId', populate: { path: 'clientId' } }
      })
      .populate('recruiterId');

    const recruiterEmail = populated.recruiterId?.email;
    const clientEmail = populated.positionId?.linkedHiringRequestId?.clientId?.email;
    const positionTitle = populated.positionId?.title || 'the position';

    const recipients = [clientEmail, recruiterEmail].filter(Boolean);
    if (recipients.length === 0) return;

    const emailText = `Hello,\n\nWe are pleased to inform you that the candidate ${booking.candidateName} has successfully cleared all interview rounds for the position "${positionTitle}" and has been selected. An offer has been extended to them.\n\nWe are awaiting their response.\n\nThank you,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recipients,
      subject: `Candidate Selected: ${booking.candidateName} for ${positionTitle}`,
      text: emailText
    });

    console.log(`Candidate selected email notification sent to ${recipients.join(', ')}`);
    for (const email of recipients) {
      await NotificationLog.create({
        type: 'selected_notification',
        recipientEmail: email,
        subject: `Candidate Selected: ${booking.candidateName}`,
        relatedBookingId: booking._id
      });
    }
  } catch (err) { console.error('Mailer error in sendCandidateSelectedNotification:', err); }
}


async function sendOfferAcceptedNotification(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const BookingModel = require('../models/Booking');
    const populated = await BookingModel.findById(booking._id)
      .populate({
        path: 'positionId',
        populate: { path: 'linkedHiringRequestId', populate: { path: 'clientId' } }
      })
      .populate('recruiterId');

    const recruiterEmail = populated.recruiterId?.email;
    const clientEmail = populated.positionId?.linkedHiringRequestId?.clientId?.email;
    const positionTitle = populated.positionId?.title || 'the position';

    const recipients = [clientEmail, recruiterEmail].filter(Boolean);
    if (recipients.length === 0) return;

    const emailText = `Hello,\n\nGreat news! The candidate ${booking.candidateName} has officially ACCEPTED the offer for the position "${positionTitle}".\n\nThank you,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recipients,
      subject: `Offer ACCEPTED: ${booking.candidateName} for ${positionTitle}`,
      text: emailText
    });

    console.log(`Offer accepted email notification sent to ${recipients.join(', ')}`);
    for (const email of recipients) {
      await NotificationLog.create({
        type: 'offer_accepted_notification',
        recipientEmail: email,
        subject: `Offer ACCEPTED: ${booking.candidateName}`,
        relatedBookingId: booking._id
      });
    }
  } catch (err) { console.error('Mailer error in sendOfferAcceptedNotification:', err); }
}


async function sendOfferDeclinedNotification(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const BookingModel = require('../models/Booking');
    const populated = await BookingModel.findById(booking._id)
      .populate({
        path: 'positionId',
        populate: { path: 'linkedHiringRequestId', populate: { path: 'clientId' } }
      })
      .populate('recruiterId');

    const recruiterEmail = populated.recruiterId?.email;
    const clientEmail = populated.positionId?.linkedHiringRequestId?.clientId?.email;
    const positionTitle = populated.positionId?.title || 'the position';

    const recipients = [clientEmail, recruiterEmail].filter(Boolean);
    if (recipients.length === 0) return;

    const emailText = `Hello,\n\nThe candidate ${booking.candidateName} has DECLINED the offer for the position "${positionTitle}".\n\nThank you,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recipients,
      subject: `Offer DECLINED: ${booking.candidateName} for ${positionTitle}`,
      text: emailText
    });

    console.log(`Offer declined email notification sent to ${recipients.join(', ')}`);
    for (const email of recipients) {
      await NotificationLog.create({
        type: 'offer_declined_notification',
        recipientEmail: email,
        subject: `Offer DECLINED: ${booking.candidateName}`,
        relatedBookingId: booking._id
      });
    }
  } catch (err) { console.error('Mailer error in sendOfferDeclinedNotification:', err); }
}


async function sendClientRejectionNotification(booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const BookingModel = require('../models/Booking');
    const populated = await BookingModel.findById(booking._id)
      .populate({
        path: 'positionId',
        populate: { path: 'linkedHiringRequestId' }
      })
      .populate('recruiterId');

    const candidateEmail = booking.candidateEmail;
    const recruiterEmail = populated.recruiterId?.email;
    const positionTitle = populated.positionId?.title || 'the position';
    const reason = booking.clientRejectionNotes || 'No specific reason provided.';

    const recipients = [candidateEmail, recruiterEmail].filter(Boolean);
    if (recipients.length === 0) return;

    const emailText = `Hello,\n\nThank you for your time and interest in the "${positionTitle}" position.\n\nWe regret to inform you that we will not be moving forward with this candidacy at this time.\n\nFeedback/Notes: ${reason}\n\nBest regards,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recipients,
      subject: `Candidacy Update: ${positionTitle}`,
      text: emailText
    });

    console.log(`Client rejection email sent to ${recipients.join(', ')}`);
    for (const email of recipients) {
      await NotificationLog.create({
        type: 'other',
        recipientEmail: email,
        subject: `Candidacy Update: ${booking.candidateName}`,
        relatedBookingId: booking._id
      });
    }
  } catch (err) { console.error('Mailer error in sendClientRejectionNotification:', err); }
}


async function sendInterviewerAssignmentNotification(interviewer, booking, round) {
  try {
    const Position = require('../models/Position');
    const User = require('../models/User');
    const position = await Position.findById(booking.positionId);
    const candidate = await User.findById(booking.candidateId);
    const recruiter = await User.findById(booking.recruiterId);

    const attachments = [];
    const cv = await attachCV(booking.candidateId);
    if (cv) attachments.push(cv);
    
    if (booking.slotStart && booking.slotEnd) {
      const icsContent = generateICS(booking, candidate, position, recruiter);
      if (icsContent) {
        attachments.push({
          filename: 'interview-invite.ics',
          content: Buffer.from(icsContent, 'utf-8'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST'
        });
      }
    }
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">Interview Assignment</h2>
        <p>Hello <strong>${interviewer.name}</strong>,</p>
        <p>You have been assigned as the interviewer for an upcoming round.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Candidate:</strong> ${candidate.name}</p>
          <p style="margin: 5px 0;"><strong>Position:</strong> ${position.title}</p>
          <p style="margin: 5px 0;"><strong>Round:</strong> ${round} of ${booking.totalRounds}</p>
          <p style="margin: 5px 0;"><strong>Date/Time:</strong> ${booking.slotStart ? new Date(booking.slotStart).toLocaleString() : 'TBD'}</p>
        </div>
        ${booking.meetLink ? `<p><strong>Google Meet Link:</strong> <br/><a href="${booking.meetLink}" style="color: #059669; text-decoration: none; font-weight: bold; background: #ecfdf5; padding: 10px 15px; border-radius: 5px; display: inline-block; margin-top: 10px;">Join Meeting Now</a></p>` : ''}
        <p>The candidate's CV is attached below to help you prepare.</p>
        <br/>
        <p>Best regards,<br/>The Ambider Team</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: interviewer.email,
      subject: `📅 Interview Assignment: ${candidate.name} for ${position.title} (Round ${round})`,
      html: htmlBody,
      attachments
    });
    console.log(`Interviewer assignment email sent to ${interviewer.email}`);
  } catch (err) { console.error('Mailer error in sendInterviewerAssignmentNotification:', err); }
}


async function sendHRRequestApprovalNotification(client, hiringRequest) {
  try {
    console.log('Sending email to:', client.email);
    const hrApprovalNote = hiringRequest.hrApprovalNote ? `\nHR Note: ${hiringRequest.hrApprovalNote}` : '';
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: client.email,
      subject: 'Your hiring request has been approved',
      text: `Hello ${client.name},\n\nYour hiring request for the position of "${hiringRequest.jobTitle}" at ${hiringRequest.companyName || client.companyName || 'your company'} has been approved by HR.${hrApprovalNote}\n\nPlease log in to your Client dashboard to track the progress.\n\nThank you,\nAmbiDer System`
    });
    console.log(`HR Request approval email sent to client ${client.email}`);
    await NotificationLog.create({
      type: 'hr_request_approved',
      recipientEmail: client.email,
      subject: `Hiring Request Approved — ${hiringRequest.jobTitle}`,
      relatedBookingId: null
    });
  } catch (err) { console.error('Mailer error in sendHRRequestApprovalNotification:', err); }
}


async function sendHRRequestRejectionNotification(client, hiringRequest) {
  try {
    console.log('Sending email to:', client.email);
    const hrRejectionReason = hiringRequest.hrRejectionReason ? `\nReason: ${hiringRequest.hrRejectionReason}` : '';
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: client.email,
      subject: 'Your hiring request was not approved',
      text: `Hello ${client.name},\n\nYour hiring request for the position of "${hiringRequest.jobTitle}" was not approved by HR.${hrRejectionReason}\n\nYou may log in to your Client dashboard, edit the request details, and resubmit it.\n\nThank you,\nAmbiDer System`
    });
    console.log(`HR Request rejection email sent to client ${client.email}`);
    await NotificationLog.create({
      type: 'hr_request_rejected',
      recipientEmail: client.email,
      subject: `Hiring Request Not Approved — ${hiringRequest.jobTitle}`,
      relatedBookingId: null
    });
  } catch (err) { console.error('Mailer error in sendHRRequestRejectionNotification:', err); }
}


async function sendOfferReExtendedNotification(candidate, booking) {
  try {
    console.log('Sending email to:', candidate.email || booking.candidateEmail);
    const positionTitle = booking.positionId?.title || 'the position';
    const newExpiry = booking.offerExpiresAt?.toLocaleString() || 'a future date';
    
    const emailText = `Dear ${candidate.name || booking.candidateName},\n\nGood news! Your offer for the ${positionTitle} position has been reinstated.\n\nThe new deadline to accept the offer is ${newExpiry}.\n\nPlease log in to the dashboard to accept or decline the offer.\n\nBest regards,\nThe Ambider Team`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email || booking.candidateEmail,
      subject: `🎉 Offer Reinstated - ${positionTitle}`,
      text: emailText
    });
    console.log(`Offer re-extended email sent to ${candidate.email || booking.candidateEmail}`);
  } catch (err) { console.error('Mailer error in sendOfferReExtendedNotification:', err); }
}

// ========================================================
// NEW AND OVERHAULED FUNCTIONS BELOW
// ========================================================


async function sendShortlistNotification(candidate, booking, position) {
  try {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">You've Been Shortlisted!</h2>
        <p>Congratulations <strong>${candidate.name}</strong>,</p>
        <p>You have been shortlisted for the <strong>${position.title}</strong> position at ${position.companyName || 'the company'}.</p>
        <p>Please log in to your Candidate Dashboard to book your interview slot.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer Recruiting</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email,
      subject: `🎉 You've been shortlisted for ${position.title} at ${position.companyName || 'the company'}`,
      html: htmlBody
    });
    console.log(`Shortlist email sent to ${candidate.email}`);
  } catch (err) { console.error('Mailer error in sendShortlistNotification:', err); }
}


async function sendSlotBookingConfirmationCandidate(candidate, booking, position) {
  try {
    const User = require('../models/User');
    const recruiter = await User.findById(booking.recruiterId);
    
    const attachments = [];
    if (booking.slotStart && booking.slotEnd) {
      const icsContent = generateICS(booking, candidate, position, recruiter);
      if (icsContent) {
        attachments.push({
          filename: 'interview-invite.ics',
          content: Buffer.from(icsContent, 'utf-8'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST'
        });
      }
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">Interview Scheduled Successfully!</h2>
        <p>Hello <strong>${candidate.name}</strong>,</p>
        <p>Your interview for the <strong>${position.title}</strong> position at ${position.companyName || 'the company'} has been confirmed.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Round:</strong> ${booking.currentRound} of ${booking.totalRounds}</p>
          <p style="margin: 5px 0;"><strong>Date/Time:</strong> ${new Date(booking.slotStart).toLocaleString()}</p>
        </div>
        ${booking.meetLink ? `<p><strong>Google Meet Link:</strong> <br/><a href="${booking.meetLink}" style="color: #059669; text-decoration: none; font-weight: bold; background: #ecfdf5; padding: 10px 15px; border-radius: 5px; display: inline-block; margin-top: 10px;">Join Meeting</a></p>` : ''}
        <p>Please find the calendar invite attached.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer Recruiting</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email,
      subject: `✅ Interview Confirmed - ${position.title}`,
      html: htmlBody,
      attachments
    });
    console.log(`Slot confirmation sent to candidate ${candidate.email}`);
  } catch (err) { console.error('Mailer error in sendSlotBookingConfirmationCandidate:', err); }
}


async function sendRoundPassedNotification(candidate, booking, position) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const companyName = position.companyName || 'the company';
    const emailText = `Congratulations ${candidate.name},\n\nYou have passed Round ${booking.currentRound - 1}!\n\nPlease log in to your Candidate Dashboard to book your slot for the next round.\n\nBest regards,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email,
      subject: `✅ Round ${booking.currentRound - 1} Passed — ${position.title} at ${companyName}`,
      text: emailText
    });
    console.log(`Round passed email sent to ${candidate.email}`);
    await NotificationLog.create({
      type: 'round_passed',
      recipientEmail: candidate.email,
      subject: `Round ${booking.currentRound - 1} Passed — ${position.title}`,
      relatedBookingId: booking?._id || null
    });
  } catch (err) { console.error('Mailer error in sendRoundPassedNotification:', err); }
}


async function sendPendingClientApprovalNotification(candidate, booking, position) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const companyName = position.companyName || 'the company';
    const emailText = `Hello ${candidate.name},\n\nYou have successfully completed all interview rounds for ${position.title}.\n\nYour profile is currently under final review by the client. We will reach out as soon as a decision is made.\n\nBest regards,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email,
      subject: `⏳ Final Review in Progress — ${position.title} at ${companyName}`,
      text: emailText
    });
    console.log(`Pending client approval email sent to candidate ${candidate.email}`);
    await NotificationLog.create({
      type: 'pending_client_approval',
      recipientEmail: candidate.email,
      subject: `Final Review in Progress — ${position.title}`,
      relatedBookingId: booking?._id || null
    });
  } catch (err) { console.error('Mailer error in sendPendingClientApprovalNotification:', err); }
}


async function sendOfferExtendedNotification(candidate, booking, position) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const companyName = position.companyName || 'the company';
    const expiryStr = booking.offerExpiresAt ? new Date(booking.offerExpiresAt).toLocaleString() : 'N/A';
    
    const emailText = `Congratulations ${candidate.name},\n\nWe are thrilled to extend an offer to you for the position of ${position.title}.\n\nThis offer expires on: ${expiryStr}\n\nPlease log in to your Candidate Dashboard to accept or decline the offer.\n\nBest regards,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email,
      subject: `🎊 Offer Extended — ${position.title} at ${companyName}`,
      text: emailText
    });
    console.log(`Offer extended email sent to ${candidate.email}`);
    await NotificationLog.create({
      type: 'offer_extended_notification',
      recipientEmail: candidate.email,
      subject: `Offer Extended — ${position.title}`,
      relatedBookingId: booking?._id || null
    });
  } catch (err) { console.error('Mailer error in sendOfferExtendedNotification:', err); }
}


async function sendOfferExpiredNotification(candidate, booking) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const positionTitle = booking.positionId?.title || 'the position';
    const emailText = `Hello ${candidate.name || booking.candidateName},\n\nYour offer for the position of ${positionTitle} has expired.\n\nIf this was unexpected, please contact your recruiter.\n\nBest regards,\nAmbiDer Recruiting`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email || booking.candidateEmail,
      subject: `⚠️ Your Offer Has Expired — ${positionTitle}`,
      text: emailText
    });
    console.log(`Offer expired email sent to ${candidate.email || booking.candidateEmail}`);
    await NotificationLog.create({
      type: 'offer_expired',
      recipientEmail: candidate.email || booking.candidateEmail,
      subject: `Offer Expired — ${positionTitle}`,
      relatedBookingId: booking?._id || null
    });
  } catch (err) { console.error('Mailer error in sendOfferExpiredNotification:', err); }
}


async function sendNewApplicationNotification(recruiter, candidate, booking, position, candidateProfile) {
  try {
    const attachments = [];
    if (candidateProfile?.cvFile?.data) {
      attachments.push({
        filename: candidateProfile.cvFile.filename || 'CV.pdf',
        content: Buffer.isBuffer(candidateProfile.cvFile.data) ? candidateProfile.cvFile.data : Buffer.from(candidateProfile.cvFile.data),
        contentType: candidateProfile.cvFile.contentType || 'application/pdf'
      });
    } else {
      const cv = await attachCV(booking.candidateId);
      if (cv) attachments.push(cv);
    }
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">New Application Received</h2>
        <p>Hello <strong>${recruiter.name}</strong>,</p>
        <p><strong>${candidate.name}</strong> has just applied for the <strong>${position.title}</strong> position at ${position.companyName || 'the company'}.</p>
        <p>Date Applied: ${new Date(booking.createdAt).toLocaleDateString()}</p>
        <p>The candidate's CV is attached to this email.</p>
        <p>Please log in to the dashboard to shortlist or reject this application.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer System</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiter.email,
      subject: `📋 New Application — ${candidate.name} for ${position.title}`,
      html: htmlBody,
      attachments
    });
    console.log(`New application email sent to recruiter ${recruiter.email}`);
  } catch (err) { console.error('Mailer error in sendNewApplicationNotification:', err); }
}


async function sendSlotBookingConfirmationRecruiter(recruiter, candidate, booking, position) {
  try {
    const attachments = [];
    const cv = await attachCV(booking.candidateId);
    if (cv) attachments.push(cv);
    
    if (booking.slotStart && booking.slotEnd) {
      const icsContent = generateICS(booking, candidate, position, recruiter);
      if (icsContent) {
        attachments.push({
          filename: 'interview-invite.ics',
          content: Buffer.from(icsContent, 'utf-8'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST'
        });
      }
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">New Interview Scheduled</h2>
        <p>Hello <strong>${recruiter.name}</strong>,</p>
        <p>An interview has just been booked by a candidate.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Candidate:</strong> ${candidate.name}</p>
          <p style="margin: 5px 0;"><strong>Position:</strong> ${position.title} (${position.companyName || 'the company'})</p>
          <p style="margin: 5px 0;"><strong>Round:</strong> ${booking.currentRound} of ${booking.totalRounds}</p>
          <p style="margin: 5px 0;"><strong>Date/Time:</strong> ${new Date(booking.slotStart).toLocaleString()}</p>
        </div>
        ${booking.meetLink ? `<p><strong>Google Meet Link:</strong> <br/><a href="${booking.meetLink}" style="color: #059669; text-decoration: none; font-weight: bold; background: #ecfdf5; padding: 10px 15px; border-radius: 5px; display: inline-block; margin-top: 10px;">Join Meeting</a></p>` : ''}
        <p>The candidate's CV and the calendar invite are attached.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer System</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiter.email,
      subject: `📅 Interview Booked: ${candidate.name} for ${position.title}`,
      html: htmlBody,
      attachments
    });
    console.log(`Slot booking confirmation sent to recruiter ${recruiter.email}`);
  } catch (err) { console.error('Mailer error in sendSlotBookingConfirmationRecruiter:', err); }
}


async function sendRoundResultNotification(recruiter, candidate, booking, position, passed) {
  try {
    console.log('Sending email to:', arguments[0].email || arguments[1]?.email);
    const resultIcon = passed ? '✅' : '❌';
    const resultText = passed ? 'Passed' : 'Failed';
    const lastRound = booking.roundHistory && booking.roundHistory.length > 0 ? booking.roundHistory[booking.roundHistory.length - 1].round : booking.currentRound;
    
    const emailText = `Hello ${recruiter.name},\n\nResult for **${candidate.name}**.\n\nRound ${lastRound} has been marked as ${resultText}.\n\nNext steps: ${passed ? 'Candidate will book the next round slot.' : 'Candidacy has been concluded.'}\n\nBest regards,\nAmbiDer System`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiter.email,
      subject: `${resultIcon} Round ${lastRound} Result — ${candidate.name} | ${position.title}`,
      text: emailText
    });
    console.log(`Round result notification sent to recruiter ${recruiter.email}`);
    await NotificationLog.create({
      type: 'round_result',
      recipientEmail: recruiter.email,
      subject: `Round ${lastRound} Result — ${candidate.name} ${resultText}`,
      relatedBookingId: booking?._id || null
    });
  } catch (err) { console.error('Mailer error in sendRoundResultNotification:', err); }
}


async function sendOfferExpiredNotificationHR(hrEmail, booking) {
  try {
    const recipient = hrEmail || process.env.MAIL_FROM;
    const positionTitle = booking.positionId?.title || 'the position';
    const expiryStr = booking.offerExpiresAt ? new Date(booking.offerExpiresAt).toLocaleString() : 'N/A';
    console.log('Sending HR offer-expired email to:', recipient);
    
    const emailText = `The offer for ${booking.candidateName} for the ${positionTitle} position has expired on ${expiryStr}.\n\nPlease log in to re-extend if needed.\n\nAmbiDer System`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recipient,
      subject: `⚠️ Offer Expired: ${booking.candidateName} for ${positionTitle}`,
      text: emailText
    });
    await NotificationLog.create({
      type: 'offer_expired',
      recipientEmail: recipient,
      subject: `Offer Expired — ${booking.candidateName} for ${positionTitle}`,
      relatedBookingId: booking?._id || null
    });
  } catch (err) { console.error('Mailer error in sendOfferExpiredNotificationHR:', err); }
}

async function sendOfferExpiredNotificationRecruiter(recruiter, booking) {
  if (!recruiter) return;
  try {
    const positionTitle = booking.positionId?.title || 'the position';
    const expiryStr = booking.offerExpiresAt ? new Date(booking.offerExpiresAt).toLocaleString() : 'N/A';
    console.log('Sending recruiter offer-expired email to:', recruiter.email);
    
    const emailText = `The offer for ${booking.candidateName} for the ${positionTitle} position has expired on ${expiryStr}.\n\nPlease log in to re-extend if needed.\n\nAmbiDer System`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiter.email,
      subject: `⚠️ Offer Expired: ${booking.candidateName} for ${positionTitle}`,
      text: emailText
    });
    await NotificationLog.create({
      type: 'offer_expired',
      recipientEmail: recruiter.email,
      subject: `Offer Expired — ${booking.candidateName} for ${positionTitle}`,
      relatedBookingId: booking?._id || null
    });
  } catch (err) { console.error('Mailer error in sendOfferExpiredNotificationRecruiter:', err); }
}

async function sendCredentialsNotification(name, email, password, role) {
  try {
    console.log('Sending credentials to:', email);
    let portalLink = 'http://localhost:5173/login';
    let roleName = role;
    if (role === 'candidate') roleName = 'Candidate';
    if (role === 'recruiter') roleName = 'Recruiter';
    if (role === 'client') roleName = 'Client';

    const emailText = `Hello ${name},\n\nYour account has been created successfully.\n\nRole: ${roleName}\n\nHere are your login credentials:\nEmail: ${email}\nPassword: ${password}\n\nPlease login at: ${portalLink}\n\nBest regards,\nAmbiDer System`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: `Welcome to AmbiDer! Your Login Credentials`,
      text: emailText
    });

    await NotificationLog.create({
      type: 'credentials_sent',
      recipientEmail: email,
      subject: 'Welcome to AmbiDer! Your Login Credentials',
      relatedBookingId: null
    });
  } catch (err) { console.error('Mailer error in sendCredentialsNotification:', err); }
}

module.exports = { 
  sendConfirmation, 
  sendRecruiterNotification, 
  sendReminder, 
  sendCancellation, 
  sendNextRoundInvite, 
  sendWithdrawal, 
  sendCandidateWithdrawalNotification,
  sendCandidateSelectedNotification,
  sendOfferAcceptedNotification,
  sendOfferDeclinedNotification,
  sendClientRejectionNotification,
  sendInterviewerAssignmentNotification,
  sendHRRequestApprovalNotification,
  sendHRRequestRejectionNotification,
  sendOfferReExtendedNotification,

  sendShortlistNotification,
  sendSlotBookingConfirmationCandidate,
  sendRoundPassedNotification,
  sendPendingClientApprovalNotification,
  sendOfferExtendedNotification,
  sendOfferExpiredNotification,
  sendNewApplicationNotification,
  sendSlotBookingConfirmationRecruiter,
  sendRoundResultNotification,
  sendOfferExpiredNotificationHR,
  sendOfferExpiredNotificationRecruiter,
  sendCredentialsNotification
};
