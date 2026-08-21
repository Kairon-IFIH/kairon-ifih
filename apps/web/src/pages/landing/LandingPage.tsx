import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import {
  Boxes,
  ShieldAlert,
  IndianRupee,
  Atom,
  FileCheck2,
  ScrollText,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { LatticeHero } from "./LatticeHero";
import { ScrollReveal } from "./ScrollReveal";
import { TypewriterHeadline } from "./TypewriterHeadline";
import { QRiskGauge } from "../../components/QRiskGauge";
import "./landing-page.css";

const PILLARS = [
  {
    icon: Boxes,
    title: "Asset Intelligence",
    copy: "Discover and classify every asset — network, application, data, physical — scored by criticality and data sensitivity.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Engine",
    copy: "Likelihood, impact, and control effectiveness computed automatically from each asset's real criticality — no spreadsheets.",
  },
  {
    icon: IndianRupee,
    title: "Financial Quantification",
    copy: "Residual risk translated into ₹ expected annual loss and financial exposure your CFO can act on.",
  },
  {
    icon: Atom,
    title: "Quantum Optimization",
    copy: "Budget-constrained remediation portfolios, solved today classically and built for a quantum backend.",
  },
  {
    icon: FileCheck2,
    title: "Compliance",
    copy: "DPDP and ISO 27001 controls mapped to the assets they protect, with a full regulatory traceability chain.",
  },
  {
    icon: ScrollText,
    title: "Audit Trail",
    copy: "Every action across every module, append-only and tenant-scoped — built to survive an examiner's questions.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Discover", copy: "Add assets manually or bulk-import a CSV — each one classified by criticality and data sensitivity." },
  { step: "02", title: "Score", copy: "KAIRON calculates likelihood × impact × control effectiveness for every asset automatically." },
  { step: "03", title: "Quantify", copy: "Residual risk becomes a ₹ figure — expected annual loss and financial exposure, side by side." },
  { step: "04", title: "Optimize", copy: "Build a remediation portfolio under a budget cap; the solver selects what to fund first." },
  { step: "05", title: "Prove", copy: "Compliance mappings and an append-only audit trail give examiners the paper trail they need." },
];

const TRUST_SIGNALS = [
  { code: "DPDP", label: "Reasonable Security Safeguards", ref: "DPDP Act 2023 · Section 8(5)" },
  { code: "ISO 27001", label: "Access Control", ref: "ISO/IEC 27001:2022 · Annex A.8" },
  { code: "GIFT City", label: "IFSCA regulatory perimeter", ref: "International Financial Services Centre" },
];

function useHeaderScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

export function LandingPage() {
  const scrolled = useHeaderScrolled();
  const heroRef = useRef<HTMLDivElement>(null);
  const [headlineDone, setHeadlineDone] = useState(false);

  // Eyebrow badge fades in immediately; the headline types itself in below it.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const targets = el.querySelectorAll(".landing-hero__reveal-early");
    gsap.set(targets, { willChange: "transform, opacity" });
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.15, clearProps: "willChange" }
    );
    return () => {
      tween.kill();
    };
  }, []);

  // Subhead + CTAs wait for the headline to finish typing before appearing.
  useEffect(() => {
    if (!headlineDone) return;
    const el = heroRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const targets = el.querySelectorAll(".landing-hero__reveal-late");
    gsap.set(targets, { willChange: "transform, opacity" });
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out", clearProps: "willChange" }
    );
    return () => {
      tween.kill();
    };
  }, [headlineDone]);

  return (
    <div className="landing">
      <header className={"landing-nav" + (scrolled ? " landing-nav--scrolled" : "")}>
        <div className="landing-nav__inner">
          <a href="#top" className="landing-nav__brand">
            <span className="landing-nav__mark">K</span>
            <span>KAIRON</span>
          </a>
          <nav className="landing-nav__links">
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Compliance</a>
          </nav>
          <Link to="/login" className="landing-nav__cta">
            Sign in
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero__lattice" aria-hidden="true">
            <LatticeHero />
          </div>
          <div className="landing-hero__content" ref={heroRef}>
            <span className="landing-hero__eyebrow landing-hero__reveal-early">Quantum-safe risk intelligence · GIFT City</span>
            <TypewriterHeadline
              className="landing-hero__headline"
              startDelayMs={500}
              speedMs={38}
              onDone={() => setHeadlineDone(true)}
              segments={[
                { text: "Know your bank's " },
                { text: "quantum risk", accent: true },
                { text: " before Q-Day does." },
              ]}
            />
            <p className="landing-hero__subhead landing-hero__reveal-late">
              KAIRON turns cryptographic exposure, asset risk, and remediation cost into one board-level number —
              the Q-Risk Score — built for India's first international financial services centre.
            </p>
            <div className="landing-hero__actions landing-hero__reveal-late">
              <Link to="/login" className="landing-button landing-button--primary">
                Sign in to your workspace <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <a href="#how-it-works" className="landing-button landing-button--ghost">
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section className="landing-section landing-problem">
          <ScrollReveal className="landing-problem__grid" stagger=".landing-reveal-item">
            <div className="landing-reveal-item landing-problem__text">
              <span className="landing-eyebrow">The quantum threat timeline</span>
              <h2 className="landing-heading">Harvest now. Decrypt later.</h2>
              <p className="landing-body">
                Adversaries are already collecting encrypted financial data today, waiting for a cryptographically
                relevant quantum computer to decrypt it. NIST finalized its post-quantum cryptography standards in
                2024. Every year of delay is data a bank can't get back once Q-Day arrives.
              </p>
            </div>
            <div className="landing-reveal-item landing-timeline">
              <div className="landing-timeline__item">
                <span className="landing-timeline__year num">2024</span>
                <span className="landing-timeline__label">NIST finalizes PQC standards (Kyber, Dilithium)</span>
              </div>
              <div className="landing-timeline__item">
                <span className="landing-timeline__year num">Now</span>
                <span className="landing-timeline__label">Harvest-now, decrypt-later collection is already underway</span>
              </div>
              <div className="landing-timeline__item landing-timeline__item--risk">
                <span className="landing-timeline__year num">Q-Day</span>
                <span className="landing-timeline__label">RSA and ECC-protected data becomes retroactively readable</span>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section id="product" className="landing-section">
          <ScrollReveal stagger=".landing-reveal-item">
            <div className="landing-reveal-item landing-section__header">
              <span className="landing-eyebrow">One platform, six bounded contexts</span>
              <h2 className="landing-heading">Everything a risk officer needs, nothing they don't</h2>
            </div>
          </ScrollReveal>
          <ScrollReveal className="landing-pillars" stagger=".landing-pillar">
            {PILLARS.map(({ icon: Icon, title, copy }) => (
              <div className="landing-pillar landing-reveal-item" key={title}>
                <Icon size={22} strokeWidth={1.6} className="landing-pillar__icon" />
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </ScrollReveal>
        </section>

        <section className="landing-section landing-qrisk">
          <ScrollReveal className="landing-qrisk__grid" stagger=".landing-reveal-item">
            <div className="landing-reveal-item landing-qrisk__text">
              <span className="landing-eyebrow">The signal your board actually needs</span>
              <h2 className="landing-heading">One score. Zero guesswork.</h2>
              <p className="landing-body">
                Asset coverage and residual risk health compose into a single 0–100 Q-Risk Score today — with
                compliance coverage, weighted financial exposure, and quantum readiness disclosed as pending inputs,
                not silently assumed. It's the number a board can act on in the two minutes they have for risk.
              </p>
              <Link to="/login" className="landing-button landing-button--primary">
                See your score <ArrowUpRight size={16} strokeWidth={2} />
              </Link>
            </div>
            <div className="landing-reveal-item landing-qrisk__gauge-card">
              <QRiskGauge score={78} />
              <span className="landing-qrisk__caption">Illustrative — live in your workspace after sign-in</span>
            </div>
          </ScrollReveal>
        </section>

        <section id="how-it-works" className="landing-section landing-steps">
          <ScrollReveal stagger=".landing-reveal-item">
            <div className="landing-reveal-item landing-section__header">
              <span className="landing-eyebrow">The pipeline</span>
              <h2 className="landing-heading">From unmanaged asset to board-ready number</h2>
            </div>
          </ScrollReveal>
          <ScrollReveal className="landing-steps__list" stagger=".landing-reveal-item">
            {HOW_IT_WORKS.map((item) => (
              <div className="landing-reveal-item landing-step" key={item.step}>
                <span className="landing-step__index num">{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </div>
            ))}
          </ScrollReveal>
        </section>

        <section id="trust" className="landing-section landing-trust">
          <ScrollReveal stagger=".landing-reveal-item">
            <div className="landing-reveal-item landing-section__header">
              <span className="landing-eyebrow">Built for GIFT City's regulatory reality</span>
              <h2 className="landing-heading">Compliance mapped, not bolted on</h2>
            </div>
          </ScrollReveal>
          <ScrollReveal className="landing-trust__grid" stagger=".landing-reveal-item">
            {TRUST_SIGNALS.map((signal) => (
              <div className="landing-reveal-item landing-trust__badge" key={signal.code}>
                <span className="landing-trust__code num">{signal.code}</span>
                <span className="landing-trust__label">{signal.label}</span>
                <span className="landing-trust__ref num">{signal.ref}</span>
              </div>
            ))}
          </ScrollReveal>
        </section>

        <section className="landing-section landing-cta">
          <ScrollReveal className="landing-cta__inner">
            <span className="landing-eyebrow landing-eyebrow--inverse">Your next board meeting is coming</span>
            <h2 className="landing-heading landing-heading--inverse">Sign in and see where you stand.</h2>
            <Link to="/login" className="landing-button landing-button--on-dark">
              Sign in to your workspace <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </ScrollReveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <span className="landing-nav__mark">K</span>
            <span>KAIRON</span>
          </div>
          <p className="landing-footer__disclosure">
            Currently using classical greedy optimization. Quantum QAOA solver in development.
          </p>
          <p className="landing-footer__copyright">© {new Date().getFullYear()} KAIRON. Financial risk intelligence for GIFT City.</p>
        </div>
      </footer>
    </div>
  );
}
