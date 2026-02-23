import { NavLink, useNavigate } from "react-router-dom";
import {
  Landmark,
  PackageCheck,
  LogOut,
} from "lucide-react";
import { NAV_ITEMS } from "../utils/constants";
import { logoutAdmin } from "../services/authService";

const iconMap = {
  "/hall-bookings": Landmark,
  "/bhandi-distribution": PackageCheck,
};

const NavTabs = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutAdmin();
    navigate("/login");
  };

  return (
    <>
      <nav className="hidden items-center gap-2 md:flex">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.path];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `btn ${isActive ? "btn-primary" : "btn-ghost"}`
              }
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
        <button type="button" className="btn btn-accent" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </button>
      </nav>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-maroon-200 bg-white/95 p-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-3 gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.path];
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-lg px-1 py-2 text-[10px] font-semibold ${
                    isActive
                      ? "bg-maroon-700 text-white"
                      : "bg-maroon-50 text-maroon-700"
                  }`
                }
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label.split(" ")[0]}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-col items-center justify-center rounded-lg bg-gold-100 px-1 py-2 text-[10px] font-semibold text-maroon-900"
          >
            <LogOut className="mb-1 h-4 w-4" />
            Logout
          </button>
        </div>
      </nav>
    </>
  );
};

export default NavTabs;
