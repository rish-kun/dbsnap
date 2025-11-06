import sgMail from "@sendgrid/mail";

export function sendEmail(
  text: string = "Database Snapshot and upload Successful",
  url: string = ""
) {
  const apiKey = process.env.SENDGRID_API_KEY;
  sgMail.setApiKey(apiKey!);
  const date = new Date();

  const msg = {
    to: "oasis2025dvmlogs@gmail.com", // Remove the "DB_BACKUP_INFO <>" wrapper
    from: {
      email: "oasis2025dvmlogs@gmail.com", // Use your VERIFIED domain, not Gmail
      name: "DB Backup System",
    },
    replyTo: "oasis2025dvmlogs@gmail.com", // Optional: where replies go
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
    })}\nBackup URL: ${url}`, // Add plain text version
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
