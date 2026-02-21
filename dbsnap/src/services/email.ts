import sgMail from "@sendgrid/mail";

export async function sendEmail(
  config: Record<string, string>,
  text: string = "Database Snapshot and upload Successful",
  url: string = "",
  onLog?: (msg: string) => void
) {
  const apiKey = config.SENDGRID_API_KEY;
  if (!apiKey) {
    if (onLog) onLog("SENDGRID_API_KEY is not set. Skipping email.");
    return;
  }
  
  sgMail.setApiKey(apiKey);
  const date = new Date();
  
  const toEmail = config.EMAIL_TO || "oasis2025dvmlogs@gmail.com";
  const fromEmail = config.EMAIL_FROM || "oasis2025dvmlogs@gmail.com";

  if (onLog) onLog(`Sending email notification to ${toEmail}...`);

  const msg = {
    to: toEmail,
    from: {
      email: fromEmail,
      name: "DB Backup System",
    },
    replyTo: fromEmail,
    subject: `Database Snapshot - ${date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    })}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Database Backup Notification</h2>
        <p><strong>${text}</strong></p>
        <p>Time: <em>${date.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}</em></p>
        ${
          url
            ? `<p><a href="${url}" style="color: #0066cc;">View Backup</a></p>`
            : ""
        }
      </div>
    `,
    text: `${text}\nTime: ${date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    })}\nBackup URL: ${url}`,
  };

  try {
    await sgMail.send(msg);
    if (onLog) onLog("✅ Email sent successfully");
  } catch (error: any) {
    if (onLog) onLog(`❌ SendGrid Error: ${error.response?.body || error}`);
  }
}
