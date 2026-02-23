import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import HallBookingsPage from "./pages/HallBookingsPage";
import BhandiDistributionPage from "./pages/BhandiDistributionPage";
import NotFoundPage from "./pages/NotFoundPage";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/hall-bookings" replace />} />
          <Route path="/hall-bookings" element={<HallBookingsPage />} />
          <Route path="/bhandi-distribution" element={<BhandiDistributionPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
