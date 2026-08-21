import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/landing/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AssetsPage } from "./pages/AssetsPage";
import { AssetDetailPage } from "./pages/AssetDetailPage";
import { RisksPage } from "./pages/RisksPage";
import { FinancialPage } from "./pages/FinancialPage";
import { OptimizationPage } from "./pages/OptimizationPage";
import { CompliancePage } from "./pages/CompliancePage";
import { AuditPage } from "./pages/AuditPage";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell title={title}>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <Shell title="Dashboard">
                <DashboardPage />
              </Shell>
            }
          />
          <Route
            path="/assets"
            element={
              <Shell title="Asset Intelligence">
                <AssetsPage />
              </Shell>
            }
          />
          <Route
            path="/assets/:id"
            element={
              <Shell title="Asset Intelligence">
                <AssetDetailPage />
              </Shell>
            }
          />
          <Route
            path="/risks"
            element={
              <Shell title="Risk Engine">
                <RisksPage />
              </Shell>
            }
          />
          <Route
            path="/financial"
            element={
              <Shell title="Financial Quantification">
                <FinancialPage />
              </Shell>
            }
          />
          <Route
            path="/optimization"
            element={
              <Shell title="Quantum Optimization">
                <OptimizationPage />
              </Shell>
            }
          />
          <Route
            path="/compliance"
            element={
              <Shell title="Compliance">
                <CompliancePage />
              </Shell>
            }
          />
          <Route
            path="/audit"
            element={
              <Shell title="Audit Trail">
                <AuditPage />
              </Shell>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
