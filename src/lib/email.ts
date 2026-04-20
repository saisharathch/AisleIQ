/**
 * Email sender. Uses Resend (https://resend.com) if RESEND_API_KEY is set,
 * otherwise logs to console for local development.
 */

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

async function sendViaResend(opts: SendEmailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'AisleIQ <noreply@aisleiq.app>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown')
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[email] No RESEND_API_KEY — printing to console instead')
    console.log(`  To:      ${opts.to}`)
    console.log(`  Subject: ${opts.subject}`)
    console.log(`  Text:    ${opts.text ?? '(html only)'}`)
    return
  }
  await sendViaResend(opts)
}

// ─── Email templates ───────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AisleIQ</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px">
              <div style="display:inline-flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#0d9488,#059669);display:flex;align-items:center;justify-content:center">
                  <span style="color:white;font-size:18px">🛒</span>
                </div>
                <span style="font-size:20px;font-weight:700;background:linear-gradient(135deg,#0d9488,#059669);-webkit-background-clip:text;-webkit-text-fill-color:transparent">AisleIQ</span>
              </div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:white;border-radius:16px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;font-size:12px;color:#94a3b8">
              AisleIQ · Upload receipts. Track smarter. Spend better.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:linear-gradient(135deg,#0d9488,#059669);color:white;font-weight:600;font-size:15px;text-decoration:none;border-radius:10px">${label}</a>`
}

export function buildVerificationEmail(opts: { name: string; url: string }) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a">Verify your email</h2>
    <p style="margin:0 0 4px;color:#64748b;font-size:15px">Hi ${opts.name || 'there'},</p>
    <p style="margin:0;color:#64748b;font-size:15px">
      Click the button below to confirm your email address and activate your AisleIQ account.
      This link expires in <strong>24 hours</strong>.
    </p>
    ${ctaButton(opts.url, 'Verify email address')}
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">
      If you didn't create an account, you can safely ignore this email.
    </p>
  `)
  const text = `Hi ${opts.name || 'there'},\n\nVerify your AisleIQ email address:\n${opts.url}\n\nThis link expires in 24 hours.`
  return { html, text, subject: 'Verify your AisleIQ email address' }
}

export function buildPasswordResetEmail(opts: { name: string; url: string }) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a">Reset your password</h2>
    <p style="margin:0 0 4px;color:#64748b;font-size:15px">Hi ${opts.name || 'there'},</p>
    <p style="margin:0;color:#64748b;font-size:15px">
      Someone requested a password reset for your AisleIQ account.
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
    </p>
    ${ctaButton(opts.url, 'Reset password')}
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">
      If you didn't request a password reset, you can safely ignore this email. Your password won't change.
    </p>
  `)
  const text = `Hi ${opts.name || 'there'},\n\nReset your AisleIQ password:\n${opts.url}\n\nThis link expires in 1 hour.`
  return { html, text, subject: 'Reset your AisleIQ password' }
}

export function buildInviteEmail(opts: { inviterName: string; url: string }) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a">You're invited to AisleIQ</h2>
    <p style="margin:0;color:#64748b;font-size:15px">
      <strong>${opts.inviterName}</strong> has invited you to join AisleIQ —
      the smart grocery receipt tracker that helps you spend better.
    </p>
    ${ctaButton(opts.url, 'Accept invitation')}
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">
      This invitation expires in 7 days. If you weren't expecting this, you can ignore it.
    </p>
  `)
  const text = `${opts.inviterName} has invited you to join AisleIQ.\n\nAccept your invitation:\n${opts.url}\n\nThis link expires in 7 days.`
  return { html, text, subject: `${opts.inviterName} invited you to AisleIQ` }
}
