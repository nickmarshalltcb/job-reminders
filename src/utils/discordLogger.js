/**
 * Discord Webhook Logger Utility
 * Sends event logs and error logs to Discord webhook via server-side function
 */

/**
 * Send log to Discord webhook via server-side function
 * @param {string} type - 'event' or 'error'
 * @param {string} message - Log message
 * @param {Object} data - Additional data to include
 * @param {string} level - Log level (info, warning, error, critical)
 */
export const sendDiscordLog = async (type, message, data = {}, level = 'info') => {
  try {
    const response = await fetch('/.netlify/functions/discord-logger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, data, level })
    });

    if (!response.ok) {
      console.error(`Failed to send Discord log: ${response.status} ${response.statusText}`);
    }
    return response.ok;
  } catch (error) {
    console.error('Error sending Discord log:', error);
    return false;
  }
};

// Convenience functions for different log types
export const logEvent = (message, data = {}, level = 'info') => sendDiscordLog('event', message, data, level);
export const logError = (message, data = {}, level = 'error') => sendDiscordLog('error', message, data, level);
export const logSystemStartup = (data = {}) => sendDiscordLog('system', 'System started up', data, 'info');
export const logAuthEvent = (action, success, data = {}) => sendDiscordLog('auth', `User ${action} ${success ? 'successfully' : 'failed'}`, data, success ? 'info' : 'error');
export const logJobOperation = (action, data = {}, success) => sendDiscordLog('job', `Job operation: ${action} ${success ? 'successful' : 'failed'}`, data, success ? 'info' : 'error');
export const logEmailOperation = (action, data = {}, success) => sendDiscordLog('email', `Email operation: ${action} ${success ? 'successful' : 'failed'}`, data, success ? 'info' : 'error');
export const logReminderOperation = (action, data = {}, success) => sendDiscordLog('reminder', `Reminder operation: ${action} ${success ? 'successful' : 'failed'}`, data, success ? 'info' : 'error');
export const logSystemError = (error, data = {}) => sendDiscordLog('error', `System error: ${error.message}`, { ...data, stack: error.stack }, 'error');
export const logCriticalError = (error, data = {}) => sendDiscordLog('error', `CRITICAL ERROR: ${error.message}`, { ...data, stack: error.stack }, 'critical');