import type { GoalConnection } from '@workspace/api-client-react';

export const formatGoalConnectionsForExport = (connections: GoalConnection[]) =>
  connections.map((connection) => [
    connection.goalTitle,
    `${connection.sourceLabel} · ${connection.evidenceClass.replaceAll('_', ' ')}`,
    connection.sourceDetail,
  ].join('\n')).join('\n\n') || 'No clinician-included goal connections.';