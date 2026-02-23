import { Outlet } from "react-router-dom";
import BrandHeader from "./BrandHeader";
import NavTabs from "./NavTabs";

const AppLayout = () => (
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

export default AppLayout;
