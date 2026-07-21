/**
 * Traduit et formate les messages d'erreur Firebase Auth en messages conviviaux en français.
 */
export function formatFirebaseError(message: string): string {
  if (!message) return "Une erreur inattendue est survenue.";

  const msgLower = message.toLowerCase();

  // Email already in use
  if (msgLower.includes("email-already-in-use") || msgLower.includes("email_already_in_use") || msgLower.includes("auth/email-already-in-use")) {
    return "Cette adresse e-mail est déjà associée à un compte existant. Veuillez vous connecter ou utiliser un autre e-mail.";
  }
  
  // Invalid email
  if (msgLower.includes("invalid-email") || msgLower.includes("invalid_email") || msgLower.includes("auth/invalid-email")) {
    return "L'adresse e-mail saisie n'est pas valide. Veuillez vérifier son format (ex: nom@domaine.com).";
  }

  // Weak password
  if (msgLower.includes("weak-password") || msgLower.includes("auth/weak-password")) {
    return "Le mot de passe choisi est trop faible. Veuillez saisir un mot de passe d'au moins 6 caractères.";
  }

  // User not found
  if (msgLower.includes("user-not-found") || msgLower.includes("user_not_found") || msgLower.includes("auth/user-not-found")) {
    return "Aucun compte n'a été trouvé avec cette adresse e-mail. Veuillez vérifier ou vous inscrire.";
  }

  // Wrong password
  if (msgLower.includes("wrong-password") || msgLower.includes("auth/wrong-password")) {
    return "Le mot de passe saisi est incorrect. Veuillez réessayer.";
  }

  // Invalid credentials
  if (msgLower.includes("invalid-credential") || msgLower.includes("invalid_credential") || msgLower.includes("auth/invalid-credential")) {
    return "Identifiants de connexion incorrects (adresse e-mail ou mot de passe erroné).";
  }

  // Pop up closed by user
  if (msgLower.includes("popup-closed-by-user") || msgLower.includes("auth/popup-closed-by-user")) {
    return "La fenêtre de connexion a été fermée avant la fin de l'opération.";
  }

  // Too many requests
  if (msgLower.includes("too-many-requests") || msgLower.includes("auth/too-many-requests")) {
    return "Trop de tentatives de connexion infructueuses. Votre compte a été temporairement bloqué. Veuillez réessayer plus tard.";
  }

  // Network request failed
  if (msgLower.includes("network-request-failed") || msgLower.includes("auth/network-request-failed")) {
    return "Erreur réseau. Veuillez vérifier votre connexion internet et réessayer.";
  }

  // Phone number already in use or invalid
  if (msgLower.includes("phone-number-already-in-use") || msgLower.includes("auth/phone-number-already-in-use")) {
    return "Ce numéro de téléphone est déjà associé à un autre compte.";
  }
  if (msgLower.includes("invalid-phone-number") || msgLower.includes("auth/invalid-phone-number")) {
    return "Le numéro de téléphone saisi n'est pas valide. Format recommandé : +226XXXXXXXX.";
  }

  // Code OTP incorrect / expiré
  if (msgLower.includes("session-expired") || msgLower.includes("auth/session-expired")) {
    return "La session de vérification OTP a expiré. Veuillez demander un nouveau code.";
  }
  if (msgLower.includes("invalid-verification-code") || msgLower.includes("auth/invalid-verification-code")) {
    return "Le code de vérification saisi est incorrect. Veuillez réessayer.";
  }

  return message;
}
