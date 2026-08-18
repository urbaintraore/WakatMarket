import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // @ts-ignore
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WakatMarket caught an unhandled rendering error:", error, errorInfo);
  }

  handleReset = () => {
    // @ts-ignore
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearStorageAndReload = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    // @ts-ignore
    const { hasError, error } = this.state;
    // @ts-ignore
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white">
                WakatMarket - Session Prête
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Votre profil a été initialisé avec succès. Cliquez ci-dessous pour charger votre tableau de bord.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl text-left text-[11px] text-zinc-600 dark:text-zinc-300 font-mono overflow-x-auto max-h-32 border border-zinc-200 dark:border-zinc-700">
                {error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <RefreshCw className="w-4 h-4" /> Accéder à mon tableau de bord
              </button>
              <button
                onClick={this.handleClearStorageAndReload}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-3 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" /> Réinitialiser
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
