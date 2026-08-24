/**
 * Utilitaire pour détecter si l'application est exécutée dans l'environnement AI Studio
 * ou en développement local, par opposition à un déploiement de production autonome.
 */
export function isAIStudioOrDevEnvironment(): boolean {
  if (typeof window === "undefined") return false;

  const host = window.location.hostname;

  // 1. Serveur de développement local
  if (
    import.meta.env.DEV ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local")
  ) {
    return true;
  }

  // 2. URLs de prévisualisation et de test AI Studio (ais-dev-*, ais-pre-*, *.google.run.app, ai.studio)
  if (
    host.includes("ais-dev-") ||
    host.includes("ais-pre-") ||
    host.includes("ais-") ||
    host.includes("ai.studio")
  ) {
    return true;
  }

  // 3. Intégration dans un iframe (aperçu dans le studio AI Studio)
  try {
    if (window.self !== window.top) {
      return true;
    }
  } catch {
    // Iframe cross-origin = dans la fenêtre d'aperçu d'AI Studio
    return true;
  }

  return false;
}
