const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { job, emailConfig } = JSON.parse(event.body);

    // Validate required data
    if (!job || !emailConfig) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required data' })
      };
    }

    // Create transporter using Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailConfig.fromEmail,
        pass: emailConfig.fromPassword
      }
    });

    // Calculate days remaining
    const today = new Date();
    const deadline = new Date(job.productionDeadline);
    const daysRemaining = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    
    let urgencyColor = '#10b981'; // green
    let urgencyText = 'On Track';
    
    if (daysRemaining < 0) {
      urgencyColor = '#ef4444'; // red
      urgencyText = 'OVERDUE';
    } else if (daysRemaining === 0) {
      urgencyColor = '#f59e0b'; // orange
      urgencyText = 'DUE TODAY';
    } else if (daysRemaining <= 2) {
      urgencyColor = '#f59e0b'; // orange
      urgencyText = 'URGENT';
    }

    // HTML Email Template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px 40px; text-align: center;">
              <div style="width: 60px; height: 60px; background-color: rgba(255, 255, 255, 0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                <span style="font-size: 30px;">🔔</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Job Reminder</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Flycast Marketing</p>
            </td>
          </tr>

          <!-- Urgency Badge -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="margin: -25px auto 0; max-width: 200px; background-color: ${urgencyColor}; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${urgencyText}
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                This is an automated reminder for the following job:
              </p>

              <!-- Job Details Card -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Job Number</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: bold; text-align: right;">${job.jobNumber}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #e5e7eb; padding-top: 12px;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Client Name</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 16px; text-align: right;">${job.clientName}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #e5e7eb; padding-top: 12px;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Forwarding Date</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 16px; text-align: right;">${new Date(job.forwardingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #e5e7eb; padding-top: 12px;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Production Deadline</td>
                        <td style="padding: 8px 0; color: ${urgencyColor}; font-size: 16px; font-weight: bold; text-align: right;">${new Date(job.productionDeadline).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #e5e7eb; padding-top: 12px;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Status</td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600;">${job.status}</span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #e5e7eb; padding-top: 12px;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Days Remaining</td>
                        <td style="padding: 8px 0; color: ${urgencyColor}; font-size: 20px; font-weight: bold; text-align: right;">${daysRemaining < 0 ? 'OVERDUE' : daysRemaining === 0 ? 'TODAY' : daysRemaining + ' days'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Required Box -->
              <div style="background-color: ${daysRemaining <= 0 ? '#fef2f2' : '#fff7ed'}; border-left: 4px solid ${urgencyColor}; padding: 16px 20px; border-radius: 6px; margin-bottom: 25px;">
                <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Action Required:</strong><br>
                  ${daysRemaining < 0 ? 'This job is overdue! Please review immediately and update the status.' : 
                    daysRemaining === 0 ? 'This job is due today! Please ensure all tasks are completed on time.' : 
                    'Please review this job and ensure all tasks are on track for the deadline.'}
                </p>
              </div>

              <!-- Dashboard Link -->
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.URL || 'https://your-app.netlify.app'}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                  View Dashboard
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                Sent by <strong>Flycast Marketing Reminder Dashboard</strong>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Automated reminder sent at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', hour12: true })} PKT
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Plain text version for email clients that don't support HTML
    const textContent = `
JOB REMINDER - ${urgencyText}

This is an automated reminder for the following job:

Job Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Job Number: ${job.jobNumber}
• Client: ${job.clientName}
• Forwarding Date: ${job.forwardingDate}
• Production Deadline: ${job.productionDeadline}
• Status: ${job.status}
• Days Remaining: ${daysRemaining < 0 ? 'OVERDUE' : daysRemaining === 0 ? 'TODAY' : daysRemaining + ' days'}

⚠️ Action Required:
${daysRemaining < 0 ? 'This job is overdue! Please review immediately and update the status.' : 
  daysRemaining === 0 ? 'This job is due today! Please ensure all tasks are completed on time.' : 
  'Please review this job and ensure all tasks are on track for the deadline.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sent by Flycast Marketing Reminder Dashboard
Automated email sent at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })} PKT
    `;

    // Email options
    const mailOptions = {
      from: `"Flycast Marketing Reminders" <${emailConfig.fromEmail}>`,
      to: emailConfig.toEmail,
      subject: `🔔 Reminder: Job ${job.jobNumber} ${urgencyText} - ${job.clientName}`,
      text: textContent,
      html: htmlContent
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Reminder email sent successfully' 
      })
    };

  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send email',
        details: error.message 
      })
    };
  }
};

