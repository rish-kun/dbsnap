import sgMail from "@sendgrid/mail";

export function sendEmail(
  text: string = "Database Snapshot and upload Successful",
  url: string = ""
) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error("SENDGRID_API_KEY is not set. Skipping email.");
    return;
  }
  sgMail.setApiKey(apiKey);
  const date = new Date();
  
  const toEmail = process.env.EMAIL_TO || "oasis2025dvmlogs@gmail.com";
  const fromEmail = process.env.EMAIL_FROM || "oasis2025dvmlogs@gmail.com";

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

  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent successfully");
    })
    .catch((error) => {
      console.error("SendGrid Error:", error.response?.body || error);
    });
}
