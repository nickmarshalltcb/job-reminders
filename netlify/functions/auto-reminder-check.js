import { createClient } from '@supabase/supabase-js';
import pkg from 'nodemailer';
const { createTransport } = pkg;

// Schedule: Run every 5 minutes
export const schedule = "*/5 * * * *";

// Discord webhook URL for logging
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Send log to Discord webhook
 */
const sendDiscordLog = async (type, message, data = {}, level = 'info') => {
  if (!DISCORD_WEBHOOK_URL) {
    console.log(`Discord log (${type}): ${message}`, data);
    return false;
  }

  try {
    const timestamp = new Date().toISOString();
    const timestampFormatted = new Date().toLocaleString('en-US', { 
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Determine color based on type and level
    let color;
    let emoji;
    
    if (type === 'error') {
      color = level === 'critical' ? 0xFF0000 : 0xFF4500; // Red or Orange-Red
      emoji = level === 'critical' ? '🚨' : '⚠️';
    } else {
      switch (level) {
        case 'warning':
          color = 0xFFA500; // Orange
          emoji = '⚠️';
          break;
        case 'error':
          color = 0xFF4500; // Orange-Red
          emoji = '❌';
          break;
        case 'critical':
          color = 0xFF0000; // Red
          emoji = '🚨';
          break;
        default:
          color = 0x00FF00; // Green
          emoji = '✅';
      }
    }

    // Create embed object
    const embed = {
      title: `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} Log - ${level.toUpperCase()}`,
      description: message,
      color: color,
      timestamp: timestamp,
      fields: [
        {
          name: '📅 Time (PKT)',
          value: timestampFormatted,
          inline: true
        },
        {
          name: '🏷️ Type',
          value: type,
          inline: true
        },
        {
          name: '📊 Level',
          value: level,
          inline: true
        }
      ],
      footer: {
        text: 'Flycast Technologies - Reminder System (Auto)',
        icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
      }
    };

    // Add additional data fields if provided
    if (Object.keys(data).length > 0) {
      embed.fields.push({
        name: '📋 Additional Data',
        value: `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        inline: false
      });
    }

    // Send to Discord webhook
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
        username: 'Reminder System Logger (Auto)',
        avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png'
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending Discord log:', error);
    return false;
  }
};

/**
 * Get current hour and minute in Pakistan timezone (UTC+5)
 */
const getPakistanTimeComponents = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  return { hour, minute, date: now };
};

/**
 * Get Pakistan time as Date object (for display only)
 */
const getPakistanTime = () => {
  return new Date(); // Return current UTC date
};

/**
 * Send email reminder
 */
const sendEmailReminder = async (jobs, emailConfig) => {
  try {
    const jobList = Array.isArray(jobs) ? jobs : [jobs];

    // Create transporter using Gmail
    const transporter = createTransport({
      service: 'gmail',
      auth: {
        user: emailConfig.fromEmail,
        pass: emailConfig.fromPassword
      }
    });

    // Calculate urgency for all jobs
    const today = new Date();
    let maxUrgency = 0; // 0: on track, 1: urgent, 2: due today, 3: overdue
    let urgencyColor = '#10b981'; // green
    let urgencyText = 'On Track';

    const jobsWithUrgency = jobList.map(job => {
      const deadline = new Date(job.production_deadline);
      const daysRemaining = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

      let jobUrgency = 0;
      let jobColor = '#10b981';
      let jobText = 'On Track';

      if (daysRemaining < 0) {
        jobUrgency = 3; // ✅ Fixed: Changed from 2 to 3 for OVERDUE
        jobColor = '#ef4444';
        jobText = 'OVERDUE';
      } else if (daysRemaining === 1) {
        jobUrgency = 1;
        jobColor = '#f59e0b';
        jobText = 'DUE TOMORROW';
      } else if (daysRemaining <= 2) {
        jobUrgency = 1;
        jobColor = '#f59e0b';
        jobText = 'URGENT';
      }
      
      if (jobUrgency > maxUrgency) {
        maxUrgency = jobUrgency;
        urgencyColor = jobColor;
        urgencyText = jobText;
      }
      
      return {
        ...job,
        daysRemaining,
        urgencyColor: jobColor,
        urgencyText: jobText
      };
    });

    // Helper function to format dates as dd-mmm-yyyy
    const formatDate = (dateString) => {
      const date = new Date(dateString + 'T00:00:00');
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // HTML Email Template - Gmail Optimized
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Job Reminder - ${jobList.length} Job${jobList.length > 1 ? 's' : ''} ${urgencyText}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
    .header p { color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px; }
    .content { padding: 24px; }
    .urgency-banner { background-color: ${urgencyColor}; color: #ffffff; padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: center; }
    .urgency-banner h2 { margin: 0; font-size: 20px; font-weight: 600; }
    .job-list { margin-bottom: 24px; }
    .job-item { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .job-header { display: flex; justify-content: between; align-items: center; margin-bottom: 8px; }
    .job-number { font-weight: 600; color: #1e293b; font-size: 16px; }
    .job-urgency { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #ffffff; background-color: ${urgencyColor}; }
    .job-details { color: #64748b; font-size: 14px; line-height: 1.5; }
    .job-details strong { color: #1e293b; }
    .footer { background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0; color: #64748b; font-size: 12px; }
    .stats { background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; }
    .stat-item { text-align: center; }
    .stat-number { font-size: 24px; font-weight: 600; color: #1e293b; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Job Reminder Alert</h1>
      <p>Automated reminder from Flycast Technologies</p>
    </div>
    
    <div class="content">
      <div class="urgency-banner">
        <h2>${urgencyText} - ${jobList.length} Job${jobList.length > 1 ? 's' : ''}</h2>
      </div>
      
      <div class="stats">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-number">${jobList.length}</div>
            <div class="stat-label">Total Jobs</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${jobList.filter(j => j.daysRemaining === 1).length}</div>
            <div class="stat-label">Due Tomorrow</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${jobList.filter(j => j.daysRemaining < 0).length}</div>
            <div class="stat-label">Overdue</div>
          </div>
        </div>
      </div>
      
      <div class="job-list">
        ${jobsWithUrgency.map(job => `
          <div class="job-item">
            <div class="job-header">
              <div class="job-number">${job.job_number}</div>
              <div class="job-urgency" style="background-color: ${job.urgencyColor};">${job.urgencyText}</div>
            </div>
            <div class="job-details">
              <strong>Client:</strong> ${job.client_name}<br>
              <strong>Deadline:</strong> ${formatDate(job.production_deadline)} (${job.daysRemaining} day${job.daysRemaining !== 1 ? 's' : ''} ${job.daysRemaining < 0 ? 'overdue' : 'remaining'})<br>
              <strong>Status:</strong> ${job.status}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Action Button -->
      <div style="text-align: center; padding: 24px 0;">
        <a href="https://jobs-reminder.netlify.app/${jobList.length === 1 ? `?job=${encodeURIComponent(jobList[0].job_number)}` : ''}"
           style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">
          View in Dashboard
        </a>
      </div>
    </div>

    <div class="footer">
      <p>This is an automated reminder from the Flycast Technologies Job Reminder System.</p>
      ${jobList.length > 1 ? `<p style="margin-top: 8px; color: #9ca3af; font-size: 11px;">Viewing multiple jobs: Use filters in the dashboard to see specific jobs.</p>` : ''}
    </div>
  </div>
</body>
</html>`;

    // Send email
    const mailOptions = {
      from: emailConfig.fromEmail,
      to: emailConfig.toEmail,
      subject: `🔔 Job Reminder: ${jobList.length} Job${jobList.length > 1 ? 's' : ''} ${urgencyText}`,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    return true;
  } catch (error) {
    console.error('Error sending email reminder:', error);
    return false;
  }
};

export const handler = async (event, context) => {
  try {
    console.log('Auto reminder check started');

    const pktTime = getPakistanTimeComponents();
    const currentHour = pktTime.hour;
    const currentMinute = pktTime.minute;

    // Check if it's 9:00 AM PKT (with 5-minute tolerance)
    const isNineAM = currentHour === 9 && currentMinute <= 4;

    // This function runs every 5 minutes and:
    // 1. At 9:00 AM PKT, sends reminders for jobs due TOMORROW (1 day before deadline)
    // 2. Always checks for jobs that are 2+ days OVERDUE and sends immediately
    console.log(`⏰ Reminder check at ${currentHour}:${String(currentMinute).padStart(2, '0')} PKT (Is 9 AM window: ${isNineAM})`);

    console.log(`Processing reminders... (Current PKT time: ${currentHour}:${String(currentMinute).padStart(2, '0')})`);
    const now = new Date(); // Current UTC time

    // Get all users with email configurations
    const { data: emailConfigs, error: configError } = await supabase
      .from('email_configurations')
      .select('*')
      .eq('configured', true);

    if (configError) {
      console.error('Error fetching email configurations:', configError);
      await sendDiscordLog('error', 'Failed to fetch email configurations', { error: configError.message }, 'error');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Failed to fetch email configurations' })
      };
    }

    console.log(`Found ${emailConfigs ? emailConfigs.length : 0} email configuration(s)`);

    // Map database columns (snake_case) to camelCase for consistency
    const mappedConfigs = emailConfigs ? emailConfigs.map(config => ({
      user_id: config.user_id,
      toEmail: config.to_email,
      fromEmail: config.from_email,
      fromPassword: config.from_password,
      configured: config.configured
    })) : [];

    if (mappedConfigs.length > 0) {
      console.log('Email configs:', mappedConfigs.map(c => ({ user_id: c.user_id, toEmail: c.toEmail, configured: c.configured })));
    }

    if (!mappedConfigs || mappedConfigs.length === 0) {
      console.log('⚠️ No email configurations found. Make sure you have saved your email configuration in Settings.');
      await sendDiscordLog('warning', 'No email configurations found', {
        message: 'No users have configured email settings. The reminder function cannot send emails.'
      }, 'warning');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          message: 'No email configurations found',
          remindersSent: 0
        })
      };
    }

    let totalRemindersSent = 0;
    let totalUsersProcessed = 0;
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }).split(',')[0]);
    today.setHours(0, 0, 0, 0);

    // Process each user's email configuration
    for (const emailConfig of mappedConfigs) {
      try {
        // Get jobs for this user that need reminders
        // Use new timestamp columns with fallback to old columns
        // Note: Since user_id column doesn't exist in jobs table, we fetch all jobs
        // This works fine for single-user systems
        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .neq('status', 'Completed');

        if (jobsError) {
          console.error(`Error fetching jobs for user ${emailConfig.user_id}:`, jobsError);
          continue;
        }

        if (!jobs || jobs.length === 0) {
          continue;
        }

        // Find jobs that should have reminders sent now
        const jobsNeedingReminders = [];

        for (const job of jobs) {
          // Check snooze expiry (priority over deadline)
          if (job.snooze_expires_at) {
            const snoozeExpiry = new Date(job.snooze_expires_at);
            if (snoozeExpiry <= now) {
              // Snooze has expired, send reminder immediately
              console.log(`Job ${job.job_number} snooze expired at ${snoozeExpiry.toISOString()} - sending immediately`);
              jobsNeedingReminders.push({ job, reason: 'snooze_expired', sendImmediately: true });
              continue;
            } else {
              // Still snoozed, skip
              console.log(`Skipping job ${job.job_number} - snoozed until ${snoozeExpiry.toISOString()}`);
              continue;
            }
          }

          // Check deadline
          const deadlineDate = new Date(job.production_deadline + 'T00:00:00+05:00');
          deadlineDate.setHours(0, 0, 0, 0);

          const isOverdue = deadlineDate < today;

          // Calculate tomorrow's date for 1-day before check
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const isDeadlineTomorrow = deadlineDate.getTime() === tomorrow.getTime();

          // OVERDUE jobs: Recurring reminders at 2, 5, and 8 days overdue
          if (isOverdue) {
            // Calculate how many days overdue
            const daysOverdue = Math.floor((today - deadlineDate) / (1000 * 60 * 60 * 24));
            const overdueReminderCount = job.overdue_reminder_count || 0;

            console.log(`Job ${job.job_number} is ${daysOverdue} day(s) overdue (deadline: ${job.production_deadline}), sent ${overdueReminderCount} overdue reminder(s)`);

            // Reminder milestones: 2, 5, and 8 days overdue (max 3 reminders)
            const milestones = [2, 5, 8];

            // Check if we should send a reminder at this milestone
            if (isNineAM && overdueReminderCount < milestones.length) {
              const nextMilestone = milestones[overdueReminderCount];

              if (daysOverdue >= nextMilestone) {
                const reminderNumber = overdueReminderCount + 1;
                console.log(`Job ${job.job_number} is ${daysOverdue} days overdue - sending overdue reminder #${reminderNumber} (milestone: ${nextMilestone} days)`);

                jobsNeedingReminders.push({
                  job,
                  reason: `overdue_reminder_${reminderNumber}`,
                  sendImmediately: true,
                  daysOverdue,
                  reminderNumber,
                  milestone: nextMilestone
                });
              } else {
                console.log(`Job ${job.job_number} is ${daysOverdue} days overdue - waiting for ${nextMilestone} days before next reminder`);
              }
            } else if (overdueReminderCount >= milestones.length) {
              console.log(`Job ${job.job_number} - max overdue reminders reached (${overdueReminderCount}/${milestones.length}), no more reminders will be sent`);
            } else if (!isNineAM) {
              console.log(`Job ${job.job_number} is ${daysOverdue} days overdue - waiting for 9 AM PKT to send reminder`);
            }
            continue;
          }

          // Jobs DUE TOMORROW (1 day before deadline): Only send at 9:00 AM PKT
          if (isDeadlineTomorrow && isNineAM) {
            // Check if reminder was already sent today
            if (job.last_reminder_sent_at) {
              const lastSentDate = new Date(job.last_reminder_sent_at);
              const lastSentPKT = new Date(lastSentDate.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
              const lastSentDay = new Date(lastSentPKT.toDateString());
              lastSentDay.setHours(0, 0, 0, 0);

              if (lastSentDay.getTime() === today.getTime()) {
                console.log(`Skipping job ${job.job_number} - reminder already sent today at ${lastSentDate.toISOString()}`);
                continue;
              }
            }

            console.log(`Job ${job.job_number} due tomorrow (deadline: ${job.production_deadline}) - sending 1 day before at 9 AM`);
            jobsNeedingReminders.push({ job, reason: 'due_tomorrow', sendImmediately: false });
          }
        }

        if (jobsNeedingReminders.length > 0) {
          // Separate immediate and scheduled reminders
          const immediateJobs = jobsNeedingReminders.filter(item => item.sendImmediately);
          const scheduledJobs = jobsNeedingReminders.filter(item => !item.sendImmediately);

          // Extract job objects from wrapper
          const jobsToSend = jobsNeedingReminders.map(item => item.job);

          console.log(`Sending bundled reminder for ${jobsToSend.length} jobs to ${emailConfig.toEmail} (${immediateJobs.length} immediate, ${scheduledJobs.length} scheduled)`);

          const emailSent = await sendEmailReminder(jobsToSend, emailConfig);

          if (emailSent) {
            // Mark jobs as reminder sent with current timestamp
            // Handle overdue vs due_tomorrow reminders differently
            for (const item of jobsNeedingReminders) {
              const updateData = {
                reminder_sent: true,
                last_reminder_sent_at: now.toISOString(),
                last_reminder_date: now.toISOString().split('T')[0], // Keep for backward compatibility
                snooze_expires_at: null, // Clear snooze since reminder was sent
                snoozed_until: null // Clear legacy snooze field
              };

              // If this was an overdue reminder, increment the counter
              if (item.reason && item.reason.startsWith('overdue_reminder_')) {
                const currentCount = item.job.overdue_reminder_count || 0;
                updateData.overdue_reminder_count = currentCount + 1;
                updateData.overdue_reminder_sent = true; // Keep for backward compatibility

                console.log(`Incrementing overdue reminder count for ${item.job.job_number}: ${currentCount} → ${currentCount + 1}`);
              }

              const { error: updateError } = await supabase
                .from('jobs')
                .update(updateData)
                .eq('id', item.job.id);

              if (updateError) {
                console.error(`Error updating job ${item.job.job_number}:`, updateError);
                await sendDiscordLog('error', 'Failed to update reminder status for job', {
                  error: updateError.message,
                  jobNumber: item.job.job_number
                }, 'error');
              }
            }

            // Success - all jobs updated
            totalRemindersSent += jobsToSend.length;
            console.log(`✅ Sent reminder for ${jobsToSend.length} jobs`);

            await sendDiscordLog('event', 'Reminder sent successfully', {
              userId: emailConfig.user_id,
              userEmail: emailConfig.toEmail,
              jobCount: jobsToSend.length,
              immediateCount: immediateJobs.length,
              scheduledCount: scheduledJobs.length,
              jobNumbers: jobsToSend.map(j => j.job_number).join(', '),
              reasons: jobsNeedingReminders.map(item => `${item.job.job_number}:${item.reason}`).join(', ')
            }, 'info');
          } else {
            await sendDiscordLog('error', 'Failed to send reminder email', {
              userId: emailConfig.user_id,
              userEmail: emailConfig.toEmail,
              jobCount: jobsToSend.length
            }, 'error');
          }
        }

        totalUsersProcessed++;
      } catch (error) {
        console.error(`Error processing user ${emailConfig.user_id}:`, error);
        await sendDiscordLog('error', `Error processing user ${emailConfig.user_id}`, { error: error.message }, 'error');
      }
    }

    await sendDiscordLog('event', '🔔 Auto reminder check completed', {
      totalUsersProcessed,
      totalRemindersSent,
      timestamp: now.toISOString(),
      pktTime: `${currentHour}:${String(currentMinute).padStart(2, '0')} (${now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })})`
    }, totalRemindersSent > 0 ? 'info' : 'warning');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Auto reminder check completed',
        totalUsersProcessed,
        totalRemindersSent,
        pktTime: `${currentHour}:${String(currentMinute).padStart(2, '0')} PKT`
      })
    };

  } catch (error) {
    console.error('Error in auto-reminder-check function:', error);

    await sendDiscordLog('error', '🚨 Auto reminder check failed', {
      error: error.message,
      stack: error.stack
    }, 'critical');

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
