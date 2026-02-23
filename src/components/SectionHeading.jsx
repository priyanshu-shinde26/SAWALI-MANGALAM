const SectionHeading = ({ title, subtitle }) => (
  <div className="mb-3">
    <h2 className="text-xl font-bold text-maroon-900">{title}</h2>
    {subtitle ? <p className="text-sm text-maroon-700">{subtitle}</p> : null}
  </div>
);

export default SectionHeading;
