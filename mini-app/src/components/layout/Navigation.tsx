import { NavLink } from "react-router-dom";
import { Home, Bot, CreditCard, BarChart3 } from "lucide-react";

const tabs = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/agent-demo", icon: Bot, label: "Agent" },
  { to: "/manual-pay", icon: CreditCard, label: "Pay" },
  { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
];

export default function Navigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-secondary-bg)] bg-[var(--color-bg)]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                isActive
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-hint)]"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
