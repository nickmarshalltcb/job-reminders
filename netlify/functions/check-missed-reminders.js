import { createClient } from '@supabase/supabase-js';

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
 * Check for missed reminders and send them
 */
export const handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { emailConfig } = JSON.parse(event.body);

    // Validate email configuration
    if (!emailConfig || !emailConfig.toEmail || !emailConfig.fromEmail || !emailConfig.fromPassword) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing email configuration' })
      };
    }

    const pkTime = getPakistanTime();
    const today = new Date(pkTime.toDateString());
    today.setHours(0, 0, 0, 0);

    // Get all jobs that are not completed
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .neq('status', 'Completed');

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    // Find jobs that should have had reminders sent but didn't
    const missedReminders = [];
    
    for (const job of jobs) {
      const deadlineDate = new Date(job.production_deadline + 'T00:00:00+05:00');
      deadlineDate.setHours(0, 0, 0, 0);
      
      const snoozedUntil = job.snoozed_until ? new Date(job.snoozed_until + 'T00:00:00+05:00') : null;
      if (snoozedUntil) {
        snoozedUntil.setHours(0, 0, 0, 0);
      }

      // Check if job is due today or overdue and reminder hasn't been sent
      const isDeadlineToday = deadlineDate.toDateString() === today.toDateString();
      const isOverdue = deadlineDate < today;
      const shouldRemindFromSnooze = snoozedUntil && snoozedUntil.toDateString() === today.toDateString();

      if ((isDeadlineToday || isOverdue || shouldRemindFromSnooze) && !job.reminder_sent) {
        missedReminders.push(job);
      }
    }

    if (missedReminders.length === 0) {
      await sendDiscordLog('event', 'No missed reminders found', {}, 'info');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: true, 
          message: 'No missed reminders found',
          missedCount: 0
        })
      };
    }

    // Group missed reminders by date for bundling
    const jobsByDate = new Map();
    
    for (const job of missedReminders) {
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

    // Send missed reminders via email
    let totalSent = 0;
    for (const [dateKey, jobsForDate] of jobsByDate) {
      if (jobsForDate.length > 0) {
        // Call the send-reminder function for each group
        try {
          const response = await fetch(`${event.headers.origin}/.netlify/functions/send-reminder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jobs: jobsForDate,
              emailConfig,
              isBundled: jobsForDate.length > 1
            })
          });

          if (response.ok) {
            totalSent += jobsForDate.length;
            
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
          }
        } catch (error) {
          console.error(`Error sending missed reminders for ${dateKey}:`, error);
        }
      }
    }

    // Log the results
    await sendDiscordLog('event', `Missed reminders check completed`, {
      totalMissed: missedReminders.length,
      totalSent: totalSent,
      dateGroups: jobsByDate.size
    }, 'info');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: true, 
        message: `Processed ${missedReminders.length} missed reminders`,
        missedCount: missedReminders.length,
        sentCount: totalSent
      })
    };

  } catch (error) {
    console.error('Error checking missed reminders:', error);
    
    // Log error to Discord
    await sendDiscordLog('error', `Failed to check missed reminders`, {
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
        error: 'Failed to check missed reminders',
        details: error.message 
      })
    };
  }
};
