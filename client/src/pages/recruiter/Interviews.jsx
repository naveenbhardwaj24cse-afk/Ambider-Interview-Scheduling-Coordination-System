import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';

const RecruiterInterviews = () => {
  const { bookings, token } = useOutletContext();
  const userId = JSON.parse(atob(token.split('.')[1])).id;

  const assignedBookings = bookings.filter(b => b.isAssignedInterviewer);

  return (
    <div>
      <div style={{ marginTop: '1rem' }}>
        <h2>My Interview Assignments</h2>
        <Card>
          <DataTable 
            headers={['Candidate', 'Company', 'Position', 'Round Assigned', 'Status']}
            emptyMessage="No interview assignments yet."
          >
            {assignedBookings.map(b => {
              const assignedRounds = b.interviewerAssignments
                ?.filter(a => a.interviewerId === userId)
                ?.map(a => a.round) || [];
              
              return (
                <tr key={b._id}>
                  <td>{b.candidateId?.name}</td>
                  <td>{b.positionId?.companyName || 'N/A'}</td>
                  <td>{b.positionId?.title || 'N/A'}</td>
                  <td>{assignedRounds.join(', ')}</td>
                  <td><StatusBadge status={b.status} type="booking" /></td>
                </tr>
              );
            })}
          </DataTable>
        </Card>
      </div>
    </div>
  );
};

export default RecruiterInterviews;
