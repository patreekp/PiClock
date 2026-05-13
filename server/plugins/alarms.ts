import { defineNitroPlugin } from 'nitropack/runtime';
import schedule from 'node-schedule';
import db from '../utils/db';
import { exec } from 'child_process';

export default defineNitroPlugin((nitroApp) => {
  console.log('Initializing Alarm Service...');
  
  const jobs = new Map();

  const scheduleAlarm = (alarm: any) => {
    if (!alarm.enabled) return;

    const [hour, minute] = alarm.time.split(':');
    const rule = new schedule.RecurrenceRule();
    rule.hour = parseInt(hour);
    rule.minute = parseInt(minute);
    rule.tz = 'Europe/Rome'; // Should ideally come from config

    const job = schedule.scheduleJob(rule, () => {
      console.log(`ALARM TRIGGERED: ${alarm.label || 'Alarm'} at ${alarm.time}`);
      // Play sound logic
      // exec('mpg321 /path/to/alarm.mp3', (error) => { ... });
    });

    jobs.set(alarm.id, job);
  };

  const reloadAlarms = () => {
    // Cancel all existing jobs
    jobs.forEach(job => job.cancel());
    jobs.clear();

    // Load from DB
    const alarms = db.prepare('SELECT * FROM alarms WHERE enabled = 1').all();
    alarms.forEach(scheduleAlarm);
    console.log(`Scheduled ${alarms.length} alarms.`);
  };

  // Initial load
  reloadAlarms();

  // Expose reload function to the app context if possible, 
  // or just listen for a custom event/hook if Nitro supports it.
  // For simplicity, we'll just export it or use a global.
  (globalThis as any).reloadAlarms = reloadAlarms;
});
