const Loader = ({ label = "Loading..." }) => (
  <div className="flex min-h-[220px] items-center justify-center">
    <div className="text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-maroon-200 border-t-maroon-700" />
      <p className="mt-3 text-sm font-medium text-maroon-700">{label}</p>
    </div>
  </div>
);

export default Loader;
