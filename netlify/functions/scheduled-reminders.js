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
        text: 'Flycast Technologies - Reminder System (Server)',
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
        username: 'Reminder System Logger (Server)',
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
 * Get current Pakistan time
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
  <title>Job Reminder - ${jobList.length === 1 ? jobList[0].job_number : `${jobList.length} Projects`}</title>
  <style type="text/css">
    /* Gmail-specific resets */
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    
    /* Prevent Gmail from changing link colors */
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    
    /* Force Gmail to display images */
    img { -ms-interpolation-mode: bicubic; }
    
    /* Mobile responsiveness */
    @media screen and (max-width: 600px) {
      .mobile-full-width { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 15px !important; }
      .mobile-text { font-size: 14px !important; }
      .mobile-button { display: block !important; width: 100% !important; margin: 8px 0 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif; line-height: 1.4; color: #333333;">
  <!-- Main Container -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #2563eb; padding: 30px 20px; border-radius: 8px 8px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">
                      Job Reminder
                    </h1>
                    <p style="margin: 8px 0 0 0; color: #dbeafe; font-size: 16px; font-family: Arial, sans-serif;">
                      ${jobList.length === 1 ? 'Job Status Update' : `${jobList.length} Jobs Requiring Attention`}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Job Details -->
          ${jobsWithUrgency.map((job, index) => `
          <tr>
            <td style="padding: 20px; border-bottom: ${index === jobsWithUrgency.length - 1 ? 'none' : '1px solid #e5e7eb'};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td>
                    <!-- Job Header -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 15px;">
                      <tr>
                        <td>
                           <h2 style="margin: 0; color: #1f2937; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif;">
                             ${job.job_number}
                           </h2>
                           <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px; font-family: Arial, sans-serif;">
                             Job No.
                           </p>
                        </td>
                        <td align="right">
                          <span style="background-color: #3b82f6; color: #ffffff; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; font-family: Arial, sans-serif; text-transform: uppercase;">
                            ${job.status}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Job Info Grid -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                            <tr>
                              <td style="width: 50%;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: bold; text-transform: uppercase; font-family: Arial, sans-serif;">Client</p>
                                <p style="margin: 4px 0 0 0; color: #1f2937; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">${job.client_name}</p>
                              </td>
                              <td style="width: 50%; text-align: right;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: bold; text-transform: uppercase; font-family: Arial, sans-serif;">Forwarding Date</p>
                                <p style="margin: 4px 0 0 0; color: #374151; font-size: 14px; font-family: Arial, sans-serif;">${formatDate(job.forwarding_date)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                            <tr>
                              <td style="width: 50%;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: bold; text-transform: uppercase; font-family: Arial, sans-serif;">Production Deadline</p>
                                <p style="margin: 4px 0 0 0; color: ${job.urgencyColor}; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">${formatDate(job.production_deadline)}</p>
                              </td>
                              <td style="width: 50%; text-align: right;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: bold; text-transform: uppercase; font-family: Arial, sans-serif;">Days Remaining</p>
                                <p style="margin: 4px 0 0 0; color: ${job.urgencyColor}; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif;">${job.daysRemaining < 0 ? 'OVERDUE' : job.daysRemaining === 0 ? 'TODAY' : job.daysRemaining + ' DAYS'}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}

          <!-- Action Required -->
          <tr>
            <td style="padding: 20px; background-color: ${maxUrgency >= 2 ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${urgencyColor};">
               <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                 <tr>
                   <td style="padding-left: 0; vertical-align: top;">
                     <h3 style="margin: 0 0 8px 0; color: ${urgencyColor}; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">Action Required</h3>
                    <p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.5; font-family: Arial, sans-serif;">
                      ${jobList.length === 1 ? 
                        (jobsWithUrgency[0].daysRemaining < 0 ? 'This job is <strong>late</strong>. Please follow up with the production team immediately.' : 
                         jobsWithUrgency[0].daysRemaining === 0 ? 'This job is <strong>due today</strong>. Please check the status with the production team.' : 
                         'Please follow up with the production team to ensure this job is on track for the deadline.') :
                        `You have ${jobList.length} jobs requiring attention. Please follow up with the production team for each job to ensure all tasks are on track for their respective deadlines.`}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

           <!-- Action Buttons -->
           <tr>
             <td style="padding: 20px; text-align: center;">
               <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                 <tr>
                   <td align="center">
                     <a href="https://jobs-reminder.netlify.app/${jobList.length === 1 ? `?job=${encodeURIComponent(jobList[0].job_number)}` : ''}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">
                       View in Dashboard
                     </a>
                   </td>
                 </tr>
               </table>
             </td>
           </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td align="center">
                     <p style="margin: 0 0 10px 0; color: #561e72; font-size: 14px; font-family: Arial, sans-serif;">
                       <strong>Flycast Technologies</strong><br>
                       Job Management & Reminder System
                     </p>
                     <p style="margin: 0; color: #9ca3af; font-size: 12px; font-family: Arial, sans-serif;">
                       This is an automated message. If you cannot view the dashboard button above, copy and paste this link:<br>
                       <span style="color: #6b7280; word-break: break-all;">https://jobs-reminder.netlify.app/${jobList.length === 1 ? `?job=${encodeURIComponent(jobList[0].job_number)}` : ''}</span>
                     </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Plain text version for email clients that don't support HTML
    const textContent = `
FLYCAST TECHNOLOGIES - JOB REMINDER
${urgencyText}

${jobList.length === 1 ? 'JOB DETAILS:' : 'JOBS REQUIRING ATTENTION:'}
───────────────────────────────────────────────────────────────
${jobsWithUrgency.map((job, index) => `
${index > 0 ? '───────────────────────────────────────────────────────────────' : ''}
Job No.: ${job.job_number}
Client: ${job.client_name}
Forwarding Date: ${formatDate(job.forwarding_date)}
Production Deadline: ${formatDate(job.production_deadline)}
Status: ${job.status}
Days Remaining: ${job.daysRemaining < 0 ? 'OVERDUE' : job.daysRemaining === 0 ? 'TODAY' : job.daysRemaining + ' days'}
`).join('')}

ACTION REQUIRED:
${jobList.length === 1 ? 
  (jobsWithUrgency[0].daysRemaining < 0 ? 'This job is LATE. Please follow up with the production team immediately.' : 
   jobsWithUrgency[0].daysRemaining === 0 ? 'This job is DUE TODAY. Please check the status with the production team.' : 
   'Please follow up with the production team to ensure this job is on track for the deadline.') :
  `You have ${jobList.length} jobs requiring attention. Please follow up with the production team for each job to ensure all tasks are on track for their respective deadlines.`}

 QUICK ACTIONS:
 ───────────────────────────────────────────────────────────────
 • View in Dashboard: https://jobs-reminder.netlify.app/${jobList.length === 1 ? `?job=${encodeURIComponent(jobList[0].job_number)}` : ''}

═══════════════════════════════════════════════════════════════

Flycast Technologies - Job Management & Reminder System
Automated reminder sent at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })}

This is an automated message. Please do not reply to this email.
     `;

    // Email options
    const mailOptions = {
      from: `"Flycast Technologies" <${emailConfig.fromEmail}>`,
      to: emailConfig.toEmail,
      subject: `Reminder: ${jobList.length === 1 ? `${jobList[0].job_number} (${jobList[0].client_name})` : `${jobList.length} Jobs`} - ${urgencyText}`,
      text: textContent,
      html: htmlContent
    };

    // Send email
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const handler = async (event, context) => {
  try {
    const pkTime = getPakistanTime();
    const hour = pkTime.getHours();
    const minute = pkTime.getMinutes();

    // Only run at 9:00 AM PKT (with some tolerance for timing issues)
    if (hour !== 9 || minute > 4) {
      await sendDiscordLog('event', 'Scheduled reminder check skipped - not the right time', {
        currentTime: `${hour}:${minute}`,
        expectedTime: '9:00 AM PKT'
      }, 'info');
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: true, 
          message: 'Scheduled reminder check completed - not the right time' 
        })
      };
    }

    const today = new Date(pkTime.toDateString());
    today.setHours(0, 0, 0, 0);

    // Get all users with email configurations
    const { data: emailConfigs, error: configError } = await supabase
      .from('email_configurations')
      .select('*')
      .eq('configured', true);

    if (configError) {
      throw new Error(`Failed to fetch email configurations: ${configError.message}`);
    }

    if (!emailConfigs || emailConfigs.length === 0) {
      await sendDiscordLog('event', 'No email configurations found for scheduled reminders', {}, 'info');
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: true, 
          message: 'No email configurations found' 
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

          // Send reminders for each date group
          for (const [dateKey, jobsForDate] of jobsByDate) {
            try {
              await sendEmailReminder(jobsForDate, emailConfig);
              totalRemindersSent += jobsForDate.length;
              
              // Update database to mark reminder as sent
              for (const job of jobsForDate) {
                await supabase
                  .from('jobs')
                  .update({
                    reminder_sent: true,
                    last_reminder_date: new Date().toISOString(),
                    snoozed_until: null
                  })
                  .eq('job_number', job.job_number);
              }
            } catch (error) {
              console.error(`Error sending reminder for user ${emailConfig.user_id} on ${dateKey}:`, error);
            }
          }
        }

        totalUsersProcessed++;
      } catch (error) {
        console.error(`Error processing user ${emailConfig.user_id}:`, error);
      }
    }

    // Log the results
    await sendDiscordLog('event', 'Scheduled reminder check completed', {
      totalUsersProcessed,
      totalRemindersSent,
      time: `${hour}:${minute} AM PKT`
    }, 'info');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Scheduled reminder check completed',
        totalUsersProcessed,
        totalRemindersSent
      })
    };

  } catch (error) {
    console.error('Error in scheduled reminders:', error);
    
    // Log error to Discord
    await sendDiscordLog('error', `Scheduled reminder check failed`, {
      error: error.message,
      stack: error.stack
    }, 'error');
    
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
