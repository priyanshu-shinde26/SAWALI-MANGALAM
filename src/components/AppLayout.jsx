import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BrandHeader from "./BrandHeader";
import NavTabs from "./NavTabs";

const HOME_ROUTE = "/hall-bookings";
const EXIT_GUARD_KEY = "__exit_guard__";

const AppLayout = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== HOME_ROUTE) {
      return undefined;
    }

    const pushGuardState = () => {
      window.history.pushState(
        { ...(window.history.state || {}), [EXIT_GUARD_KEY]: true },
        "",
        window.location.href
      );
    };

    if (!window.history.state?.[EXIT_GUARD_KEY]) {
      pushGuardState();
    }

    const onPopState = () => {
      const shouldExit = window.confirm(
        "Do you want to exit Sawali Mangalam Admin?"
      );

      if (shouldExit) {
        window.removeEventListener("popstate", onPopState);
        setTimeout(() => window.history.back(), 0);
        return;
      }

      pushGuardState();
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-maroon-glow pb-24 md:pb-10">
      <div className="mx-auto w-full max-w-6xl px-3 pb-5 pt-3 md:px-6 md:pt-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <BrandHeader />
          <NavTabs />
        </div>
        <main className="mt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
