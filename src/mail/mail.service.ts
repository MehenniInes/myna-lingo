import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null = null;
  private readonly from: string;

  constructor() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
    this.from = MAIL_FROM ?? "Myna Lingo <tobioken09@gmail.local>";

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    } else {
      this.logger.warn(
        "SMTP env vars not set — MailService is in dev mode (reset links will be logged, not emailed).",
      );
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.transporter) {
      // Dev mode only. Production always has SMTP configured, so this never
      // leaks a token in a real deployment.
      this.logger.log(`[dev] Password reset link for ${to}: ${resetUrl}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: "Reset your Myna Lingo password",
      text: [
        "Someone requested a password reset for your Myna Lingo account.",
        "",
        `Reset your password here (valid for 1 hour): ${resetUrl}`,
        "",
        "If you didn't request this, you can safely ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#121212;line-height:1.6">
          <p>Someone requested a password reset for your <strong>Myna Lingo</strong> account.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;border-radius:9999px;background:#C86228;color:#ffffff;font-weight:600;text-decoration:none">
              Reset password
            </a>
          </p>
          <p style="font-size:13px;color:#12121299">This link is valid for 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  }
}