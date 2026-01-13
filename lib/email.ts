// lib/email.ts
// Service d'envoi d'email avec Resend

import { Resend } from "resend";

/**
 * Envoyer un email de vérification
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
) {
  const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

  try {
    console.log("[sendVerificationEmail] API Key:", apiKey?.substring(0, 10) + "...");
    console.log("[sendVerificationEmail] Envoi à:", email);
    console.log("[sendVerificationEmail] From:", emailFrom);
    
    // Créer une nouvelle instance Resend à chaque appel
    const resend = new Resend(apiKey);
    
    const result = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: "Vérifiez votre email - Jeezy TV",
      html: `
        <h1>Bienvenue sur Jeezy TV! 🎉</h1>
        <p>Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous:</p>
        <a href="${verificationLink}" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #00ff41;
          color: #000000;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
        ">
          Vérifier mon email
        </a>
        <p>Ou copiez ce lien dans votre navigateur:</p>
        <p><code>${verificationLink}</code></p>
        <p>Ce lien expire dans 24 heures.</p>
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #00ff41;" />
        <p style="color: #999;">Si vous n'avez pas créé ce compte, ignorez cet email.</p>
      `,
    });

    console.log("[sendVerificationEmail] ✅ Succès - Réponse complète:", JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("[sendVerificationEmail] ❌ Erreur:", error);
    throw error;
  }
}

/**
 * Envoyer un email de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "noreply@jeezy.tv";

  try {
    const resend = new Resend(apiKey);
    return await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@jeezy.tv",
      to: email,
      subject: "Réinitialiser votre mot de passe - Jeezy TV",
      html: `
        <h1>Réinitialisation du mot de passe</h1>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe:</p>
        <a href="${resetLink}" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #00ff41;
          color: #000000;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
        ">
          Réinitialiser le mot de passe
        </a>
        <p>Ce lien expire dans 1 heure.</p>
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #00ff41;" />
        <p style="color: #999;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      `,
    });
  } catch (error) {
    console.error("[sendPasswordResetEmail] Error:", error);
    throw error;
  }
}
