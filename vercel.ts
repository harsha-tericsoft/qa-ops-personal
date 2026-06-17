export default {
  crons: [
    {
      path: '/api/roam/scheduled-sync',
      schedule: '*/5 * * * *', // Every 5 minutes
    },
  ],
}
