import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

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
 * Get Pakistan time
 */
const getPakistanTime = () => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
};

/**
 * Send email reminder
 */
const sendEmailReminder = async (jobs, emailConfig) => {
  try {
    const jobList = Array.isArray(jobs) ? jobs : [jobs];

    // Create transporter using Gmail
    const transporter = nodemailer.createTransporter({
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
        jobUrgency = 3;
        jobColor = '#ef4444';
        jobText = 'OVERDUE';
      } else if (daysRemaining === 0) {
        jobUrgency = 2;
        jobColor = '#f59e0b';
        jobText = 'DUE TODAY';
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
            <div class="stat-number">${jobList.filter(j => j.daysRemaining === 0).length}</div>
            <div class="stat-label">Due Today</div>
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
    </div>
    
    <div class="footer">
      <p>This is an automated reminder from the Flycast Technologies Job Reminder System.</p>
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
    
    const pkTime = getPakistanTime();
    const today = new Date(pkTime.toDateString());
    today.setHours(0, 0, 0, 0);

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

    if (!emailConfigs || emailConfigs.length === 0) {
      console.log('No email configurations found');
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

    // Process each user's email configuration
    for (const emailConfig of emailConfigs) {
      try {
        // Get jobs for this user that need reminders
        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .neq('status', 'Completed')
          .eq('reminder_sent', false);

        if (jobsError) {
          console.error(`Error fetching jobs for user ${emailConfig.user_id}:`, jobsError);
          continue;
        }

        if (!jobs || jobs.length === 0) {
          continue;
        }

        // Find jobs that should have reminders sent today
        const jobsNeedingReminders = [];
        
        for (const job of jobs) {
          const deadlineDate = new Date(job.production_deadline + 'T00:00:00+05:00');
          deadlineDate.setHours(0, 0, 0, 0);
          
          const snoozedUntil = job.snoozed_until ? new Date(job.snoozed_until + 'T00:00:00+05:00') : null;
          if (snoozedUntil) {
            snoozedUntil.setHours(0, 0, 0, 0);
          }

          // Check if job is due today or overdue
          const isDeadlineToday = deadlineDate.toDateString() === today.toDateString();
          const isOverdue = deadlineDate < today;
          const shouldRemindFromSnooze = snoozedUntil && snoozedUntil.toDateString() === today.toDateString();

          if (isDeadlineToday || isOverdue || shouldRemindFromSnooze) {
            jobsNeedingReminders.push(job);
          }
        }

        if (jobsNeedingReminders.length > 0) {
          // Group jobs by date for bundling
          const jobsByDate = new Map();
          
          for (const job of jobsNeedingReminders) {
            const deadlineDate = new Date(job.production_deadline + 'T00:00:00+05:00');
            deadlineDate.setHours(0, 0, 0, 0);
            
            const snoozedUntil = job.snoozed_until ? new Date(job.snoozed_until + 'T00:00:00+05:00') : null;
            if (snoozedUntil) {
              snoozedUntil.setHours(0, 0, 0, 0);
            }

            const dateKey = snoozedUntil ? snoozedUntil.toDateString() : deadlineDate.toDateString();
            
            if (!jobsByDate.has(dateKey)) {
              jobsByDate.set(dateKey, []);
            }
            jobsByDate.get(dateKey).push(job);
          }

          // Send reminders for each date
          for (const [dateKey, jobsForDate] of jobsByDate) {
            if (jobsForDate.length > 0) {
              const emailSent = await sendEmailReminder(jobsForDate, emailConfig);
              
              if (emailSent) {
                // Mark jobs as reminder sent
                const jobIds = jobsForDate.map(job => job.id);
                const { error: updateError } = await supabase
                  .from('jobs')
                  .update({ 
                    reminder_sent: true,
                    last_reminder_date: new Date().toISOString()
                  })
                  .in('id', jobIds);

                if (updateError) {
                  console.error('Error updating reminder status:', updateError);
                } else {
                  totalRemindersSent += jobsForDate.length;
                  console.log(`Sent ${jobsForDate.length} reminders for date ${dateKey}`);
                }
              }
            }
          }
        }

        totalUsersProcessed++;
      } catch (error) {
        console.error(`Error processing user ${emailConfig.user_id}:`, error);
        await sendDiscordLog('error', `Error processing user ${emailConfig.user_id}`, { error: error.message }, 'error');
      }
    }

    await sendDiscordLog('event', 'Auto reminder check completed', {
      totalUsersProcessed,
      totalRemindersSent,
      timestamp: new Date().toISOString()
    }, 'info');

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
        totalRemindersSent
      })
    };

  } catch (error) {
    console.error('Error in auto-reminder-check function:', error);
    
    await sendDiscordLog('error', 'Auto reminder check failed', {
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
