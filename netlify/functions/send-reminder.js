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

    // Helper function to format dates as dd-mmm-yyyy
    const formatDate = (dateString) => {
      const date = new Date(dateString + 'T00:00:00');
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

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

    // HTML Email Template - Enhanced Version
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Job Reminder - ${job.jobNumber}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    /* Mobile-first responsive styles */
    @media only screen and (max-width: 600px) {
      .mobile-padding { padding: 20px !important; }
      .mobile-text-small { font-size: 14px !important; }
      .mobile-text-medium { font-size: 16px !important; }
      .mobile-heading { font-size: 24px !important; }
      .mobile-badge { padding: 10px 20px !important; font-size: 15px !important; }
      .mobile-button { padding: 14px 32px !important; font-size: 15px !important; }
      .mobile-full-width { width: 100% !important; max-width: 100% !important; }
      .mobile-hide { display: none !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;" class="mobile-padding">
        <table role="presentation" class="mobile-full-width" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px; text-align: center;" class="mobile-padding">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <div style="width: 70px; height: 70px; background-color: rgba(255, 255, 255, 0.25); border-radius: 16px; display: inline-block; line-height: 70px; margin-bottom: 16px; text-align: center;">
                      <span style="font-size: 36px; vertical-align: middle;">🔔</span>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;" class="mobile-heading">Job Reminder</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.95); font-size: 15px; font-weight: 500;" class="mobile-text-small">Flycast Marketing</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Urgency Badge -->
          <tr>
            <td style="padding: 0 40px;" class="mobile-padding">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <div style="margin-top: -28px; display: inline-block; background-color: ${urgencyColor}; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 17px; box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15); letter-spacing: 0.5px;" class="mobile-badge">
                      ${urgencyText}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;" class="mobile-padding">
              <p style="margin: 0 0 28px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;" class="mobile-text-small">
                This is an automated reminder for the following job:
              </p>

              <!-- Job Details Card -->
              <table role="presentation" class="mobile-full-width" style="width: 100%; border-collapse: collapse; background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%); border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;" class="mobile-padding">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; width: 45%;">Job Number</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 18px; font-weight: 700; text-align: right; width: 55%;">${job.jobNumber}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 0;"><div style="height: 1px; background-color: #e5e7eb; margin: 4px 0;"></div></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Client Name</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 17px; font-weight: 600; text-align: right;">${job.clientName}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 0;"><div style="height: 1px; background-color: #e5e7eb; margin: 4px 0;"></div></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Forwarding Date</td>
                        <td style="padding: 12px 0; color: #111827; font-size: 16px; font-weight: 500; text-align: right;">${formatDate(job.forwardingDate)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 0;"><div style="height: 1px; background-color: #e5e7eb; margin: 4px 0;"></div></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Production Deadline</td>
                        <td style="padding: 12px 0; color: ${urgencyColor}; font-size: 17px; font-weight: 700; text-align: right;">${formatDate(job.productionDeadline)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 0;"><div style="height: 1px; background-color: #e5e7eb; margin: 4px 0;"></div></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Status</td>
                        <td style="padding: 12px 0; text-align: right;">
                          <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">${job.status}</span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 0;"><div style="height: 1px; background-color: #e5e7eb; margin: 4px 0;"></div></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Days Remaining</td>
                        <td style="padding: 12px 0; color: ${urgencyColor}; font-size: 24px; font-weight: 800; text-align: right; letter-spacing: -0.5px;">${daysRemaining < 0 ? 'OVERDUE' : daysRemaining === 0 ? 'TODAY' : daysRemaining + ' DAYS'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Required Box -->
              <table role="presentation" class="mobile-full-width" style="width: 100%; border-collapse: collapse; background-color: ${daysRemaining <= 0 ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${urgencyColor}; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 18px 20px;" class="mobile-padding">
                    <p style="margin: 0; color: #111827; font-size: 15px; line-height: 1.6;" class="mobile-text-small">
                      <strong style="display: block; font-size: 16px; margin-bottom: 6px; color: ${urgencyColor};">⚠️ Action Required</strong>
                      ${daysRemaining < 0 ? 'This job is <strong>overdue</strong>! Please review immediately and update the status.' : 
                        daysRemaining === 0 ? 'This job is <strong>due today</strong>! Please ensure all tasks are completed on time.' : 
                        'Please review this job and ensure all tasks are on track for the deadline.'}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Dashboard Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 10px 0;">
                    <a href="${process.env.URL || 'https://your-app.netlify.app'}#job-${job.id}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); transition: all 0.2s;" class="mobile-button">
                      View Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e7eb;" class="mobile-padding">
              <p style="margin: 0 0 6px 0; color: #6b7280; font-size: 14px; font-weight: 500;" class="mobile-text-small">
                Sent by <strong style="color: #374151;">Flycast Marketing Reminder Dashboard</strong>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;" class="mobile-text-small">
                Automated reminder sent at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Email Client Support Text -->
        <table role="presentation" style="max-width: 600px; width: 100%; margin: 20px auto 0;">
          <tr>
            <td align="center" style="padding: 0 20px;">
              <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                If you cannot view the dashboard button above, copy and paste this link: <br>
                <span style="color: #6b7280;">${process.env.URL || 'https://your-app.netlify.app'}#job-${job.id}</span>
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
• Forwarding Date: ${formatDate(job.forwardingDate)}
• Production Deadline: ${formatDate(job.productionDeadline)}
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

