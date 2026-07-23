import React from 'react';
import './CandidateStepperTimeline.css';

const STAGES = [
  'Application',
  'Screening',
  'Interview Rounds',
  'Offer',
  'Accepted'
];

const CandidateStepperTimeline = ({ booking }) => {
  let activeIndex = 0;
  let isTerminal = false;
  let terminalLabel = '';
  let terminalColor = '';

  const { status, currentRound, totalRounds, slotStart, clientRejectionNotes } = booking;

  if (status === 'applied') activeIndex = 0;
  else if (status === 'confirmed') activeIndex = 1;
  else if (status === 'pending_next_round') activeIndex = 2;
  else if (status === 'pending_client_approval' || status === 'selected') activeIndex = 3;
  else if (status === 'offer_accepted') activeIndex = 4;
  else {
    isTerminal = true;
    if (status === 'expired') {
      activeIndex = 3;
      terminalLabel = 'Offer Expired';
      terminalColor = '#f97316'; // orange
    } else if (status === 'offer_declined') {
      activeIndex = 3;
      terminalLabel = 'Declined';
      terminalColor = '#ef4444'; // red
    } else if (status === 'rejected') {
      terminalLabel = 'Not Progressed';
      terminalColor = '#ef4444'; // red
      if (clientRejectionNotes || (currentRound === totalRounds && booking.roundsCleared === totalRounds)) activeIndex = 3;
      else if (currentRound > 0) activeIndex = 2;
      else if (slotStart) activeIndex = 1;
      else activeIndex = 0;
    } else if (status === 'withdrawn') {
      terminalLabel = 'Withdrawn';
      terminalColor = '#6b7280'; // gray
      if (currentRound > 0) activeIndex = 2;
      else if (slotStart) activeIndex = 1;
      else activeIndex = 0;
    } else if (status === 'cancelled') {
      terminalLabel = 'Cancelled';
      terminalColor = '#6b7280'; // gray
      if (currentRound > 0) activeIndex = 2;
      else if (slotStart) activeIndex = 1;
      else activeIndex = 0;
    } else {
      activeIndex = 0;
      terminalLabel = status;
      terminalColor = '#6b7280';
    }
  }

  // If status is offer_accepted, all steps are complete
  const isAllComplete = status === 'offer_accepted';

  return (
    <div className="stepper-container fade-in">
      {STAGES.map((stage, index) => {
        const isCompleted = isAllComplete || (!isTerminal && index < activeIndex) || (isTerminal && index < activeIndex);
        const isActive = !isTerminal && index === activeIndex;
        const isCurrentTerminal = isTerminal && index === activeIndex;

        return (
          <React.Fragment key={stage}>
            <div className="stepper-step">
              <div className="stepper-icon-container">
                {isCompleted ? (
                  <div className="stepper-circle completed">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="stepper-circle active">
                    <div className="pulse-ring"></div>
                    <div className="stepper-circle-inner"></div>
                  </div>
                ) : isCurrentTerminal ? (
                  <div className="stepper-circle terminal" style={{ backgroundColor: terminalColor, borderColor: terminalColor }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                ) : (
                  <div className="stepper-circle upcoming"></div>
                )}
              </div>
              <div className="stepper-label">
                <span style={{ 
                  color: isCurrentTerminal ? terminalColor : (isCompleted || isActive) ? 'var(--text-primary, #333)' : 'var(--text-muted, #64748b)', 
                  fontWeight: isActive || isCurrentTerminal ? 'bold' : 'normal' 
                }}>
                  {isCurrentTerminal ? terminalLabel : stage}
                </span>
                {stage === 'Interview Rounds' && (isActive || isCurrentTerminal) && currentRound > 0 && (
                  <div className="stepper-sublabel">Round {currentRound} of {totalRounds}</div>
                )}
              </div>
            </div>
            {index < STAGES.length - 1 && (
              <div className={`stepper-connector ${isCompleted ? 'completed' : 'upcoming'}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default CandidateStepperTimeline;
