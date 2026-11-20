import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import mjml2html from 'mjml'
import { config } from '../config.ts'

const EMAILS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../emails')

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    })
  : null

const copy = {
  en: {
    subject: '{code} · Sign in to Collector',
    preview: 'Your sign-in link and code',
    hello: 'Hello {name},',
    body: 'Tap the button below to open your collection.',
    cta: 'Open my collection',
    codeLabel: 'Or enter this code in the app',
    colon: ': ',
    expires: 'The link and the code work once and expire in {min} minutes.',
    ignore: "Didn't ask for this? You can safely ignore this email.",
  },
  fr: {
    subject: '{code} · Connexion à Collector',
    preview: 'Votre lien et votre code de connexion',
    hello: 'Bonjour {name},',
    body: 'Touchez le bouton ci-dessous pour ouvrir votre collection.',
    cta: 'Ouvrir ma collection',
    codeLabel: 'Ou saisissez ce code dans l’app',
    colon: ' : ',
    expires: 'Le lien et le code ne servent qu’une fois et expirent dans {min} minutes.',
    ignore: 'Vous n’êtes pas à l’origine de cette demande ? Ignorez simplement cet e-mail.',
  },
}

// MJML is compiled once; each email only fills the placeholders.
let template: Promise<string> | null = null
function compiled() {
  template ??= (async () => {
    const source = await fs.readFile(path.join(EMAILS, 'magic-link.mjml'), 'utf8')
    const { html, errors } = await mjml2html(source, { validationLevel: 'soft' })
    for (const e of errors || []) console.warn(`MJML: ${e.formattedMessage}`)
    return html
  })()
  return template
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export async function sendMagicLink(user: any, link: string, code: string, locale: string = user.locale) {
  const t = copy[locale as 'en' | 'fr'] || copy.en
  const name = user.name || user.email.split('@')[0]
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  const fill = (s: string) => s.replace('{name}', name).replace('{min}', String(config.magicLinkMinutes)).replace('{code}', spaced)

  if (!transport) {
    console.log(`\n✉️  SMTP not configured — sign-in for ${user.email}: code ${spaced}\n   ${link}\n`)
    return
  }

  const values: Record<string, string> = {
    PREVIEW: fill(t.preview),
    HELLO: fill(t.hello),
    BODY: fill(t.body),
    CTA: t.cta,
    LINK: link,
    CODE_LABEL: t.codeLabel,
    CODE: spaced,
    EXPIRES: fill(t.expires),
    IGNORE: t.ignore,
  }
  const html = (await compiled()).replace(/%%([A-Z_]+)%%/g, (m, key) => (key in values ? escapeHtml(values[key]) : m))

  await transport.sendMail({
    from: config.smtp.from,
    to: user.email,
    subject: fill(t.subject),
    text: `${fill(t.hello)}\n\n${fill(t.body)}\n${link}\n\n${t.codeLabel}${t.colon}${spaced}\n${fill(t.expires)}\n\n${t.ignore}`,
    html,
    attachments: [{ filename: 'collector.png', path: path.join(EMAILS, 'logo.png'), cid: 'collector-logo' }],
  })
}
