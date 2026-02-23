import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="mx-auto mt-12 max-w-md rounded-2xl border border-maroon-100 bg-white p-6 text-center shadow-card">
    <h1 className="text-2xl font-bold text-maroon-900">Page Not Found</h1>
    <p className="mt-2 text-sm text-maroon-700">
      The page you are looking for does not exist.
    </p>
    <Link to="/hall-bookings" className="btn btn-primary mt-4">
      Back to Hall Bookings
    </Link>
  </div>
);

export default NotFoundPage;
