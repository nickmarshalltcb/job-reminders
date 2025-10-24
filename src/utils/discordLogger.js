/**
 * Discord Webhook Logger Utility
 * Sends event logs and error logs to Discord webhook via server-side function
 */

// Debounce tracking to prevent excessive logging
const logDebounceMap = new Map();
const DEBOUNCE_TIME = 5000; // 5 seconds

/**
 * Debounced logging function to prevent spam
 * @param {string} key - Unique key for the log message
 * @param {Function} logFunction - The logging function to call
 * @param {number} debounceTime - Time in milliseconds to debounce (default: 5000)
 */
const debouncedLog = (key, logFunction, debounceTime = DEBOUNCE_TIME) => {
  const now = Date.now();
  const lastLogTime = logDebounceMap.get(key) || 0;
  
  if (now - lastLogTime > debounceTime) {
    logDebounceMap.set(key, now);
    return logFunction();
  } else {
    console.log(`Debounced log: ${key} (last logged ${Math.round((now - lastLogTime) / 1000)}s ago)`);
    return Promise.resolve(false);
  }
};

/**
 * Send log to Discord webhook via server-side function
 * @param {string} type - 'event' or 'error'
 * @param {string} message - Log message
 * @param {Object} data - Additional data to include
 * @param {string} level - Log level (info, warning, error, critical)
 * @param {boolean} useDebounce - Whether to use debouncing (default: false)
 */
export const sendDiscordLog = async (type, message, data = {}, level = 'info', useDebounce = false) => {
  const logFunction = async () => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:8888/.netlify/functions/discord-logger`, {
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

  if (useDebounce) {
    const debounceKey = `${type}-${message}`;
    return debouncedLog(debounceKey, logFunction);
  } else {
    return logFunction();
  }
};

// Convenience functions for different log types
export const logEvent = (message, data = {}, level = 'info') => sendDiscordLog('event', message, data, level);
export const logError = (message, data = {}, level = 'error') => sendDiscordLog('error', message, data, level);
export const logSystemStartup = (data = {}) => sendDiscordLog('system', 'System started up', data, 'info', true); // Use debouncing for startup logs
export const logAuthEvent = (action, success, data = {}) => sendDiscordLog('auth', `User ${action} ${success ? 'successfully' : 'failed'}`, data, success ? 'info' : 'error');
export const logJobOperation = (action, data = {}, success) => sendDiscordLog('job', `Job operation: ${action} ${success ? 'successful' : 'failed'}`, data, success ? 'info' : 'error');
export const logEmailOperation = (action, data = {}, success) => sendDiscordLog('email', `Email operation: ${action} ${success ? 'successful' : 'failed'}`, data, success ? 'info' : 'error');
export const logReminderOperation = (action, data = {}, success) => sendDiscordLog('reminder', `Reminder operation: ${action} ${success ? 'successful' : 'failed'}`, data, success ? 'info' : 'error');
export const logSystemError = (error, data = {}) => sendDiscordLog('error', `System error: ${error.message}`, { ...data, stack: error.stack }, 'error');
export const logCriticalError = (error, data = {}) => sendDiscordLog('error', `CRITICAL ERROR: ${error.message}`, { ...data, stack: error.stack }, 'critical');