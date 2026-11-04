"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ROLE_COOKIE, ROLE_LABEL, type AppRole } from "@/lib/role";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/estimates/new", label: "New", icon: "M12 5v14M5 12h14" },
  { href: "/estimates", label: "Estimates", icon: "M7 3h10l4 4v14H3V3h4zm0 0v4h10" },
  { href: "/templates", label: "Templates", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2-1.2L14.5 2h-4l-.4 2.6a7.6 7.6 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 002 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function AppShell({ role, children }: { role: AppRole; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : href === "/estimates" ? pathname.startsWith("/estimates") && pathname !== "/estimates/new" : pathname.startsWith(href));
  const setRole = (r: AppRole) => {
    document.cookie = `${ROLE_COOKIE}=${r}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  const printOnly = pathname.endsWith("/customer");

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className={cx("no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur", printOnly && "")}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-sm font-black text-white">TB</span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-brand-900">TruBlue</span>
              <span className="block text-xs text-muted">Job Estimator</span>
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={cx("rounded-lg px-3 py-2 text-sm font-medium", isActive(n.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50")}>
                {n.href === "/estimates/new" ? "New Estimate" : n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label className="sr-only" htmlFor="role">View as</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="min-h-9 rounded-lg border border-line bg-white px-2 text-sm font-medium"
              title="Role-based view (V1 has no login — this filters what is shown)"
            >
              {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive(n.href) ? "text-brand-600" : "text-slate-500")}>
            <Icon d={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
