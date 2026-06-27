import { Component } from "react";

// Captura erros de renderização e mostra uma mensagem em vez de tela branca.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }
  static getDerivedStateFromError(erro) {
    return { erro };
  }
  componentDidCatch(erro, info) {
    console.error("Erro capturado:", erro, info);
  }
  reset = () => this.setState({ erro: null });
  render() {
    if (this.state.erro) {
      return (
        <div style={{ padding: 32, maxWidth: 640, margin: "40px auto", fontFamily: "Inter, sans-serif" }}>
          <div style={{
            background: "#fbecea", border: "1px solid #f0c8c2", color: "#c2412f",
            borderRadius: 10, padding: 20,
          }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Algo deu errado ao exibir esta tela</h2>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
              O sistema encontrou um erro. A mensagem técnica abaixo ajuda a identificar a causa:
            </p>
            <pre style={{
              background: "#fff", padding: 12, borderRadius: 6, fontSize: 12,
              overflow: "auto", whiteSpace: "pre-wrap", color: "#7a2a1f", margin: "0 0 12px",
            }}>
              {String(this.state.erro?.message || this.state.erro)}
            </pre>
            <button onClick={() => window.location.reload()} style={{
              background: "#1f9d5a", color: "#fff", border: "none", padding: "9px 16px",
              borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              Recarregar a página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
