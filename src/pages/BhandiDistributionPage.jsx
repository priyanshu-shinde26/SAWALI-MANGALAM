import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import Loader from "../components/Loader";
import {
  DEFAULT_DISTRIBUTION_ITEMS,
  EVENT_PURPOSE_OPTIONS,
} from "../utils/constants";
import { parseDateLabel } from "../utils/time";
import {
  createDistribution,
  deleteDistribution,
  subscribeDistributions,
} from "../services/distributionService";
import { exportDistributionStatementPdf } from "../utils/pdf";

const CUSTOM_ITEM_OPTION = "__other__";
const CUSTOM_FUNCTION_OPTION = "__other_function__";
const FUNCTION_NAME_OPTIONS = EVENT_PURPOSE_OPTIONS.filter(
  (option) => option !== "Other"
);

const getInitialItem = () => ({
  selectedItem: "",
  customItemName: "",
  quantityGiven: "",
});

const initialForm = {
  functionName: "",
  customFunctionName: "",
  personName: "",
  mobile: "",
  eventDate: "",
  returnDate: "",
  items: [getInitialItem()],
};

let distributionCache = [];
let distributionHydrated = false;

const BhandiDistributionPage = () => {
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState(distributionCache);
  const [loading, setLoading] = useState(!distributionHydrated);
  const [saving, setSaving] = useState(false);
  const [deletingDistributionId, setDeletingDistributionId] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const unsubscribe = subscribeDistributions(
      (rows) => {
        distributionCache = rows;
        distributionHydrated = true;
        setRecords(rows);
        setLoading(false);
      },
      (error) => {
        distributionHydrated = true;
        setLoading(false);
        setMessage({
          type: "error",
          text: error.message || "Could not load distribution records.",
        });
      }
    );
    return unsubscribe;
  }, []);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        if (dateFilter && record.eventDate !== dateFilter) return false;
        if (
          personFilter &&
          !String(record.personName || "")
            .toLowerCase()
            .includes(personFilter.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [records, dateFilter, personFilter]
  );

  const updateItem = (index, key, value) => {
    setForm((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, items: updated };
    });
  };

  const addItemRow = () =>
    setForm((prev) => ({ ...prev, items: [...prev.items, getInitialItem()] }));

  const removeItemRow = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });
    setSaving(true);

    try {
      const isCustomFunction = form.functionName === CUSTOM_FUNCTION_OPTION;
      const resolvedFunctionName = isCustomFunction
        ? form.customFunctionName.trim()
        : form.functionName.trim();

      if (!resolvedFunctionName) {
        throw new Error("Function name is required.");
      }

      const normalizedItems = form.items.map((item) => {
        const isCustom = item.selectedItem === CUSTOM_ITEM_OPTION;
        const itemName = isCustom
          ? String(item.customItemName || "").trim()
          : String(item.selectedItem || "").trim();

        return {
          itemName,
          quantityGiven: item.quantityGiven,
        };
      });

      const hasValidItem = normalizedItems.some(
        (item) => item.itemName && Number(item.quantityGiven) > 0
      );
      if (!hasValidItem) {
        throw new Error("Add at least one item with quantity.");
      }

      await createDistribution({
        functionName: resolvedFunctionName,
        personName: form.personName.trim(),
        mobile: form.mobile.trim(),
        eventDate: form.eventDate,
        returnDate: form.returnDate,
        items: normalizedItems,
      });

      setForm(initialForm);
      setMessage({ type: "success", text: "Distribution record created." });
    } catch (createError) {
      const isPermissionError =
        createError?.code === "permission-denied" ||
        String(createError?.message || "")
          .toLowerCase()
          .includes("insufficient permissions");

      setMessage({
        type: "error",
        text: isPermissionError
          ? "Firestore permission denied. Login with admin account and deploy Firestore rules."
          : createError.message || "Could not save distribution.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDeleteDistribution = async (record) => {
    const distributionLabel = record.personName || record.functionName || record.id;
    const shouldDelete = window.confirm(
      `Delete distribution "${distributionLabel}"? This action cannot be undone.`
    );
    if (!shouldDelete) return;

    try {
      setDeletingDistributionId(record.id);
      await deleteDistribution(record.id);
      setMessage({ type: "success", text: "Distribution deleted successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not delete distribution.",
      });
    } finally {
      setDeletingDistributionId("");
    }
  };

  return (
    <section>
      <SectionHeading
        title="Bhandi & Sahitya Distribution"
        subtitle="Record distributed material and generate printable statements."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <form className="card space-y-3" onSubmit={onSubmit}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-maroon-800">
            New Distribution Entry
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Function Name</label>
              <select
                className="input"
                value={form.functionName}
                onChange={(event) => {
                  const selectedValue = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    functionName: selectedValue,
                    customFunctionName:
                      selectedValue === CUSTOM_FUNCTION_OPTION
                        ? prev.customFunctionName
                        : "",
                  }));
                }}
                required
              >
                <option value="">Select function</option>
                {FUNCTION_NAME_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value={CUSTOM_FUNCTION_OPTION}>Other</option>
              </select>
              {form.functionName === CUSTOM_FUNCTION_OPTION ? (
                <input
                  className="input mt-2"
                  value={form.customFunctionName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      customFunctionName: event.target.value,
                    }))
                  }
                  placeholder="Type custom function name"
                  required
                />
              ) : null}
            </div>
            <div>
              <label className="label">Person Name</label>
              <input
                className="input"
                value={form.personName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, personName: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label">Mobile Number</label>
              <input
                className="input"
                value={form.mobile}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, mobile: event.target.value }))
                }
                minLength={10}
                maxLength={10}
                required
              />
            </div>
            <div>
              <label className="label">Event Date</label>
              <input
                className="input"
                type="date"
                value={form.eventDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, eventDate: event.target.value }))
                }
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Return Date</label>
              <input
                className="input"
                type="date"
                value={form.returnDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, returnDate: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="rounded-xl border border-maroon-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-maroon-900">Item Distribution</h4>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={addItemRow}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </button>
            </div>
            <p className="mb-2 text-xs text-maroon-700">
              Select an item from dropdown. Choose "Other" to type a custom item.
            </p>
            <div className="space-y-2">
              {form.items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-maroon-200 bg-maroon-50/30 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-maroon-700">
                      Item {index + 1}
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1.5"
                      onClick={() => removeItemRow(index)}
                      disabled={form.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="label">Select Item</label>
                      <select
                        className="input h-11"
                        value={item.selectedItem}
                        onChange={(event) => {
                          const selectedValue = event.target.value;
                          updateItem(index, "selectedItem", selectedValue);
                          if (selectedValue !== CUSTOM_ITEM_OPTION) {
                            updateItem(index, "customItemName", "");
                          }
                        }}
                      >
                        <option value="">Select item</option>
                        {DEFAULT_DISTRIBUTION_ITEMS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value={CUSTOM_ITEM_OPTION}>Other</option>
                      </select>
                    </div>

                    {item.selectedItem === CUSTOM_ITEM_OPTION ? (
                      <div>
                        <label className="label">Custom Item Name</label>
                        <input
                          className="input h-11"
                          type="text"
                          placeholder="Type custom item name"
                          value={item.customItemName}
                          onChange={(event) =>
                            updateItem(index, "customItemName", event.target.value)
                          }
                        />
                      </div>
                    ) : null}

                    <div>
                      <label className="label">Quantity</label>
                      <input
                        className="input h-11"
                        type="number"
                        min="1"
                        placeholder="Enter quantity"
                        value={item.quantityGiven}
                        onChange={(event) =>
                          updateItem(index, "quantityGiven", event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {message.text ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                message.type === "error"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary w-full" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving Distribution..." : "Save Distribution"}
          </button>
        </form>

        <div className="space-y-3">
          <div className="card">
            <h3 className="text-sm font-bold uppercase tracking-wide text-maroon-800">
              Search Filters
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                />
              </div>
              <div>
                <label className="label">Person Name</label>
                <input
                  className="input"
                  value={personFilter}
                  onChange={(event) => setPersonFilter(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => {
                    setDateFilter("");
                    setPersonFilter("");
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <Loader label="Loading distribution records..." />
          ) : filteredRecords.length === 0 ? (
            <div className="card text-sm text-maroon-700">
              No distribution records found for selected filters.
            </div>
          ) : (
            filteredRecords.map((record) => (
              <article key={record.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-maroon-900">{record.personName}</h3>
                    <p className="text-sm text-maroon-700">
                      Function: {record.functionName || record.purpose || "-"}
                    </p>
                    <p className="text-sm text-maroon-700">
                      Date: {parseDateLabel(record.eventDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => exportDistributionStatementPdf(record)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-rose-700 hover:bg-rose-50"
                      onClick={() => onDeleteDistribution(record)}
                      disabled={deletingDistributionId === record.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingDistributionId === record.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default BhandiDistributionPage;

