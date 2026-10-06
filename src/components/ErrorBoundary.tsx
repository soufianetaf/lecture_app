import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Message affiché à la place de la partie qui a planté. */
  message?: string;
  /** Change de valeur → l'erreur est oubliée (ex. changement d'écran ou de mot). */
  resetKey?: unknown;
  compact?: boolean;
}

interface State {
  error: Error | null;
  resetKey: unknown;
}

/**
 * Isole une partie de l'interface : si elle plante, on affiche un message et
 * un bouton « Réessayer » au lieu d'une page blanche pour toute l'application.
 * (Les « error boundaries » doivent encore être des composants classe en React.)
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur d’affichage', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className={this.props.compact ? 'p-4 text-sm' : 'mx-auto max-w-md p-8 text-center'}>
        <p className="font-medium">{this.props.message ?? 'Un problème est survenu à l’affichage.'}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-3 rounded-lg bg-amber-600 px-4 py-1.5 text-sm text-white hover:bg-amber-700"
        >
          Réessayer
        </button>
      </div>
    );
  }
}
