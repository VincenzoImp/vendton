import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { miniApp, viewport, init as initTMA } from "@telegram-apps/sdk-react";

import Header from "./components/layout/Header";
import Navigation from "./components/layout/Navigation";
import Marketplace from "./pages/Marketplace";
import Deploy from "./pages/Deploy";
import Playground from "./pages/Playground";
import Profile from "./pages/Profile";

const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST_URL ||
  new URL("/tonconnect-manifest.json", window.location.origin).toString();

function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg)]">
      <Header />
      <main className="flex-1 pb-16 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Marketplace />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Marketplace />} />
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
      // Running outside Telegram
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
