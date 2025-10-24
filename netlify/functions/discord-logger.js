import { createClient } from '@supabase/supabase-js';

// Discord webhook URL for logging
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const embed = {
      title: `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} Log - ${level.toUpperCase()}`,
      description: message,
      color: color,
      timestamp: timestamp,
      fields: [
        { name: '📅 Time (PKT)', value: timestampFormatted, inline: true },
        { name: '🏷️ Type', value: type, inline: true },
        { name: '📊 Level', value: level, inline: true }
      ],
      footer: {
        text: 'Flycast Technologies - Reminder System (Server)',
        icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
      }
    };

    if (Object.keys(data).length > 0) {
      embed.fields.push({
        name: '📋 Additional Data',
        value: `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        inline: false
      });
    }

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
        username: 'Reminder System Logger (Server)',
        avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png'
      })
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

export const handler = async (event, context) => {
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
    const { type, message, data, level } = JSON.parse(event.body);

    if (!type || !message) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: type and message' })
      };
    }

    const success = await sendDiscordLog(type, message, data, level);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ success })
    };

  } catch (error) {
    console.error('Error in discord-logger function:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
