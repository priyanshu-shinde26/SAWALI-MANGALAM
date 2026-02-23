import { EVENT_PURPOSE_OPTIONS } from "../utils/constants";

const ReportFilters = ({ filters, onChange, onReset }) => (
  <div className="card mb-4">
    <h3 className="text-sm font-bold uppercase tracking-wide text-maroon-800">
      Search Filters
    </h3>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
      <div>
        <label className="label">Date</label>
        <input
          className="input"
          type="date"
          value={filters.date}
          onChange={(event) => onChange("date", event.target.value)}
        />
      </div>
      <div>
        <label className="label">Person Name</label>
        <input
          className="input"
          type="text"
          placeholder="Search person"
          value={filters.personName}
          onChange={(event) => onChange("personName", event.target.value)}
        />
      </div>
      <div>
        <label className="label">Event Type</label>
        <select
          className="input"
          value={filters.eventPurpose}
          onChange={(event) => onChange("eventPurpose", event.target.value)}
        >
          <option value="">All</option>
          {EVENT_PURPOSE_OPTIONS.map((purpose) => (
            <option key={purpose} value={purpose}>
              {purpose}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button type="button" className="btn btn-ghost w-full" onClick={onReset}>
          Reset Filters
        </button>
      </div>
    </div>
  </div>
);

export default ReportFilters;
