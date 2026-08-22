import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/landing/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AssetsPage } from "./pages/AssetsPage";
import { AssetDetailPage } from "./pages/AssetDetailPage";
import { RisksPage } from "./pages/RisksPage";
import { ScannerPage } from "./pages/ScannerPage";
import { FinancialPage } from "./pages/FinancialPage";
import { OptimizationPage } from "./pages/OptimizationPage";
import { CompliancePage } from "./pages/CompliancePage";
import { AuditPage } from "./pages/AuditPage";

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell title={title} subtitle={subtitle}>
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <Shell title="Dashboard" subtitle="What changed, what is unusual, and what needs a decision — across the whole institution.">
                  <DashboardPage />
                </Shell>
              }
            />
            <Route
              path="/assets"
              element={
                <Shell title="Asset Intelligence" subtitle="The institution's digital surface, grouped by where exposure actually concentrates.">
                  <AssetsPage />
                </Shell>
              }
            />
            <Route
              path="/assets/:id"
              element={
                <Shell title="Asset Intelligence" subtitle="The institution's digital surface, grouped by where exposure actually concentrates.">
                  <AssetDetailPage />
                </Shell>
              }
            />
            <Route
              path="/scanner"
              element={
                <Shell title="Quantum Scanner" subtitle="Every cryptographic primitive in use across the estate, graded for post-quantum readiness.">
                  <ScannerPage />
                </Shell>
              }
            />
            <Route
              path="/risks"
              element={
                <Shell title="Risk Engine" subtitle="Likelihood × impact, discounted by control effectiveness, scored per asset.">
                  <RisksPage />
                </Shell>
              }
            />
            <Route
              path="/financial"
              element={
                <Shell title="Financial Quantification" subtitle="Technical exposure translated into currency an executive committee can act on.">
                  <FinancialPage />
                </Shell>
              }
            />
            <Route
              path="/optimization"
              element={
                <Shell title="Quantum Optimization" subtitle="Where the system decides: which remediation portfolio buys the most risk reduction per rupee.">
                  <OptimizationPage />
                </Shell>
              }
            />
            <Route
              path="/compliance"
              element={
                <Shell title="Compliance" subtitle="Regulation → clause → control → evidence, traced end to end for every mapped asset.">
                  <CompliancePage />
                </Shell>
              }
            />
            <Route
              path="/audit"
              element={
                <Shell title="Audit Trail" subtitle="Append-only record of every state change. Nothing mutates it, including this screen.">
                  <AuditPage />
                </Shell>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
