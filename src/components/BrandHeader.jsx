const BrandHeader = () => (
  <header className="rounded-2xl bg-maroon-800/95 p-3 text-white shadow-card">
    <div className="flex items-center gap-3">
      <img
        src="/sawali-logo.svg"
        alt="Sawali Mangalam Logo"
        className="h-14 w-14 rounded-xl object-cover ring-2 ring-gold-300/70"
      />
      <div>
        <h1 className="text-lg font-bold tracking-wide text-gold-200">
          SAWALI MANGALAM
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-gold-100/90">
          Hall For Weddings & Events
        </p>
      </div>
    </div>
  </header>
);

export default BrandHeader;
