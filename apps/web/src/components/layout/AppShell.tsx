import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import "./app-shell.css";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar title={title} />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
