import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { gsap } from "gsap";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { ApiRequestError } from "../lib/api-client";
import { useTypewriter } from "../lib/use-typewriter";
import { LatticeHero } from "./landing/LatticeHero";
import "./login-page.css";

const TAGLINES = ["Discover every asset.", "Quantify residual risk.", "Prove compliance instantly."];

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("admin@demo-bank.example");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { text: typedTagline, wordIndex, setWordIndex, setPhase } = useTypewriter(TAGLINES);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = form.querySelectorAll(".login-form__reveal");
    gsap.set(targets, { willChange: "transform, opacity" });
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: "power3.out", delay: 0.2, clearProps: "willChange" }
    );
    return () => {
      tween.kill();
    };
  }, []);

  if (isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiRequestError ? "Incorrect email or password." : "Couldn't reach the server — check that the API is running.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-card__art">
          <div className="login-card__lattice">
            <LatticeHero />
          </div>
          <div className="login-card__art-top">
            <span className="login-card__wordmark">
              <img src="/kairon-logo-dark.png" alt="KAIRON" className="login-card__mark" /> KAIRON
            </span>
            <Link to="/" className="login-card__back">
              Back to website <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
          <div className="login-card__art-bottom">
            <span className="login-card__eyebrow">Financial risk intelligence</span>
            <p className="login-card__typewriter">
              {typedTagline}
              <span className="login-card__caret" aria-hidden="true" />
            </p>
            <div className="login-card__dots">
              {TAGLINES.map((line, i) => (
                <button
                  key={line}
                  type="button"
                  className={"login-card__dot" + (i === wordIndex ? " login-card__dot--active" : "")}
                  aria-label={`Show tagline: ${line}`}
                  onClick={() => {
                    setWordIndex(i);
                    setPhase("typing");
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="login-card__form-side">
          <form className="login-form" onSubmit={handleSubmit} ref={formRef}>
            <h1 className="login-form__reveal login-form__heading">Welcome back</h1>
            <p className="login-form__reveal login-form__subhead">Sign in to your KAIRON workspace</p>

            <label className="login-form__reveal login-form__field">
              <span className="login-form__label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@bank.example"
              />
            </label>

            <label className="login-form__reveal login-form__field">
              <span className="login-form__label">Password</span>
              <div className="login-form__password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="login-form__toggle-visibility"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>
            </label>

            {error && (
              <p className="login-form__reveal login-form__error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="login-form__reveal login-form__submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
              {!submitting && <ArrowRight size={16} strokeWidth={2} />}
            </button>

            <p className="login-form__reveal login-form__hint">
              Demo tenant — <span className="num">admin@demo-bank.example</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
