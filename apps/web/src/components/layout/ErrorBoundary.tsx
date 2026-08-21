import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, a render-time throw anywhere unmounts the whole tree — a
 * blank white page with nothing in the console (React logs to console.error
 * by default, but that's easy to miss and gives no way back for the user).
 * Catches it, shows the message, and offers a reload instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            height: "100vh",
            fontFamily: "system-ui, sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "18px", margin: 0 }}>Something went wrong on this page</h1>
          <p style={{ color: "#666", margin: 0, maxWidth: "480px" }}>{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "8px",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
