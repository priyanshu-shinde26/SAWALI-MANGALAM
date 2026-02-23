const MetricCard = ({ label, value, accent = "maroon" }) => (
  <article
    className={`rounded-2xl p-4 shadow-card ${
      accent === "gold"
        ? "bg-gold-50 ring-1 ring-gold-200"
        : "bg-white ring-1 ring-maroon-100"
    }`}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-maroon-700">
      {label}
    </p>
    <p className="mt-2 text-2xl font-bold text-maroon-900">{value}</p>
  </article>
);

export default MetricCard;
