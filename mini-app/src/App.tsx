import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { miniApp, viewport, init as initTMA } from "@telegram-apps/sdk-react";

import Header from "./components/layout/Header";
import Navigation from "./components/layout/Navigation";
import Home from "./pages/Home";
import AgentDemo from "./pages/AgentDemo";
import ManualPay from "./pages/ManualPay";
import Dashboard from "./pages/Dashboard";

const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST_URL ||
  new URL("/tonconnect-manifest.json", window.location.origin).toString();

function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg)]">
      <Header />
      <main className="flex-1 pb-16 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agent-demo" element={<AgentDemo />} />
          <Route path="/manual-pay" element={<ManualPay />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
      <Navigation />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    try {
      initTMA();
      miniApp.ready();
      viewport.expand();
    } catch {
      // Running outside Telegram — ignore SDK init errors
    }
  }, []);

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </TonConnectUIProvider>
  );
}
