import sgMail from "@sendgrid/mail";

export function sendEmail(
  text: String = "Database Snapshot and upload Successful",
  url: String = ""
) {
  const apiKey = process.env.SENDGRID_API_KEY;
  sgMail.setApiKey(apiKey!);
  const date = new Date();

  const msg = {
    to: "DB_BACKUP_INFO <oasis2025dvmlogs@gmail.com>",
    from: "DB_BACKUP_INFO <oasis2025dvmlogs@gmail.com>",
    subject: "Database Snapshot and upload Successful",
    html: `
  <strong>${text}</strong> at <i>${date}</i>
  <br/>
  <a href="${url}">Backup URL</a>
  `,
  };
  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent");
    })
    .catch((error) => {
      console.error(error);
    });
}

// sendEmail();
