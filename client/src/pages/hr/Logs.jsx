import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../../components/Card';
import DataTable from '../../components/DataTable';

const HRLogs = () => {
  const { logs } = useOutletContext();

  return (
    <div>
      <div style={{ marginTop: '1rem' }}>
        <h2>System Notification Logs</h2>
        <Card>
          <DataTable 
            headers={['Time', 'Type', 'Recipient', 'Booking ID']}
            emptyMessage="No logs yet."
          >
            {logs.map(log => (
              <tr key={log._id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.type}</td>
                <td>{log.recipientEmail}</td>
                <td>{log.relatedBookingId || 'N/A'}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </div>
  );
};

export default HRLogs;
