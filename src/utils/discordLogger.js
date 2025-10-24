/**
 * Discord Webhook Logger Utility
 * Sends event logs and error logs to Discord webhook
 */

const DISCORD_WEBHOOK_URL = import.meta.env.VITE_DISCORD_WEBHOOK_URL;

if (!DISCORD_WEBHOOK_URL) {
  console.warn('VITE_DISCORD_WEBHOOK_URL environment variable is not set. Discord logging will be disabled.');
}

/**
 * Send log to Discord webhook
 * @param {string} type - 'event' or 'error'
 * @param {string} message - Log message
 * @param {Object} data - Additional data to include
 * @param {string} level - Log level (info, warning, error, critical)
 */
export const sendDiscordLog = async (type, message, data = {}, level = 'info') => {
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
        text: 'Flycast Technologies - Reminder System',
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
        username: 'Reminder System Logger',
        avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png'
      })
    });

    if (!response.ok) {
      console.error('Failed to send Discord log:', response.status, response.statusText);
    }

    return response.ok;
  } catch (error) {
    console.error('Error sending Discord log:', error);
    return false;
  }
};

/**
 * Log event to Discord
 * @param {string} message - Event message
 * @param {Object} data - Additional data
 * @param {string} level - Log level
 */
export const logEvent = async (message, data = {}, level = 'info') => {
  return await sendDiscordLog('event', message, data, level);
};

/**
 * Log error to Discord
 * @param {string} message - Error message
 * @param {Object} data - Additional data
 * @param {string} level - Log level
 */
export const logError = async (message, data = {}, level = 'error') => {
  return await sendDiscordLog('error', message, data, level);
};

/**
 * Log system startup
 */
export const logSystemStartup = async () => {
  return await logEvent('System started successfully', {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  }, 'info');
};

/**
 * Log user authentication events
 */
export const logAuthEvent = async (action, success, data = {}) => {
  return await logEvent(`User ${action} ${success ? 'successful' : 'failed'}`, {
    action,
    success,
    ...data
  }, success ? 'info' : 'warning');
};

/**
 * Log job operations
 */
export const logJobOperation = async (operation, jobData = {}, success = true) => {
  return await logEvent(`Job ${operation} ${success ? 'completed' : 'failed'}`, {
    operation,
    success,
    jobNumber: jobData.jobNumber || 'Unknown',
    clientName: jobData.clientName || 'Unknown',
    ...jobData
  }, success ? 'info' : 'error');
};

/**
 * Log email operations
 */
export const logEmailOperation = async (operation, emailData = {}, success = true) => {
  return await logEvent(`Email ${operation} ${success ? 'completed' : 'failed'}`, {
    operation,
    success,
    recipientCount: emailData.recipientCount || 1,
    jobCount: emailData.jobCount || 0,
    ...emailData
  }, success ? 'info' : 'error');
};

/**
 * Log reminder operations
 */
export const logReminderOperation = async (operation, reminderData = {}, success = true) => {
  return await logEvent(`Reminder ${operation} ${success ? 'completed' : 'failed'}`, {
    operation,
    success,
    jobCount: reminderData.jobCount || 0,
    ...reminderData
  }, success ? 'info' : 'error');
};

/**
 * Log system errors
 */
export const logSystemError = async (error, context = {}) => {
  return await logError(`System error: ${error.message || error}`, {
    error: error.toString(),
    stack: error.stack,
    context
  }, 'error');
};

/**
 * Log critical system errors
 */
export const logCriticalError = async (error, context = {}) => {
  return await logError(`CRITICAL SYSTEM ERROR: ${error.message || error}`, {
    error: error.toString(),
    stack: error.stack,
    context
  }, 'critical');
};
