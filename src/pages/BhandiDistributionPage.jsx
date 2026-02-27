import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Edit3,
  IndianRupee,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import Loader from "../components/Loader";
import {
  DEFAULT_DISTRIBUTION_ITEMS,
  EVENT_PURPOSE_OPTIONS,
} from "../utils/constants";
import { formatCurrency } from "../utils/format";
import { parseDateLabel } from "../utils/time";
import {
  createDistribution,
  deleteDistribution,
  receiveDistributionPendingPayment,
  subscribeDistributions,
  updateDistribution,
} from "../services/distributionService";
import { exportDistributionStatementPdf } from "../utils/pdf";

const CUSTOM_ITEM_OPTION = "__other__";
const CUSTOM_FUNCTION_OPTION = "__other_function__";
const FUNCTION_NAME_OPTIONS = EVENT_PURPOSE_OPTIONS.filter(
  (option) => option !== "Other"
);

const DEFAULT_DISTRIBUTION_ITEM_PRICES = [
  40, 10, 50, 10, 10, 20, 30, 10, 10, 10, 10, 10, 20, 20, 20, 10, 30, 20, 10,
  150, 50, 25, 150, 100, 50, 150, 2, 1, 3, 50, 200, 25, 10, 10, 100,
];

const ITEM_UNIT_PRICE_MAP = DEFAULT_DISTRIBUTION_ITEMS.reduce((acc, item, index) => {
  acc[item] = DEFAULT_DISTRIBUTION_ITEM_PRICES[index] ?? 0;
  return acc;
}, {});

const getInitialItem = () => ({
  selectedItem: "",
  customItemName: "",
  quantityGiven: "",
  unitPrice: "",
});

const initialForm = {
  functionName: "",
  customFunctionName: "",
  personName: "",
  mobile: "",
  eventDate: "",
  returnDate: "",
  advanceAmount: "0",
  items: [getInitialItem()],
};

const toNonNegativeNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const resolveItemName = (item) => {
  const isCustom = item.selectedItem === CUSTOM_ITEM_OPTION;
  return isCustom
    ? String(item.customItemName || "").trim()
    : String(item.selectedItem || "").trim();
};

const resolveUnitPrice = (item) => {
  const isDefaultItem =
    item.selectedItem && item.selectedItem !== CUSTOM_ITEM_OPTION;
  if (isDefaultItem) {
    return toNonNegativeNumber(ITEM_UNIT_PRICE_MAP[item.selectedItem]);
  }

  return toNonNegativeNumber(item.unitPrice);
};

const buildFormItemFromRecord = (item) => {
  const itemName = String(item?.itemName || "").trim();
  const isKnownItem = DEFAULT_DISTRIBUTION_ITEMS.includes(itemName);
  const mappedUnitPrice = toNonNegativeNumber(ITEM_UNIT_PRICE_MAP[itemName]);
  const storedUnitPrice = toNonNegativeNumber(item?.unitPrice);
  const unitPrice = isKnownItem
    ? storedUnitPrice || mappedUnitPrice
    : storedUnitPrice;

  return {
    selectedItem: isKnownItem ? itemName : CUSTOM_ITEM_OPTION,
    customItemName: isKnownItem ? "" : itemName,
    quantityGiven:
      item?.quantityGiven === undefined || item?.quantityGiven === null
        ? ""
        : String(item.quantityGiven),
    unitPrice: unitPrice ? String(unitPrice) : "",
  };
};

const getRecordFinancials = (record) => {
  const explicitTotal = Number(record.totalPrice);
  const hasExplicitTotal = Number.isFinite(explicitTotal) && explicitTotal >= 0;
  const calculatedFromItems = (record.items || []).reduce((sum, item) => {
    const quantity = toNonNegativeNumber(item.quantityGiven);
    const lineTotal = Number(item.lineTotal);
    if (Number.isFinite(lineTotal) && lineTotal >= 0) {
      return sum + lineTotal;
    }

    return sum + quantity * toNonNegativeNumber(item.unitPrice);
  }, 0);

  const totalPrice = hasExplicitTotal ? explicitTotal : calculatedFromItems;
  const advance = Number(record.advanceAmount);
  const advanceAmount = Number.isFinite(advance) && advance >= 0 ? advance : 0;
  const remaining = Number(record.remainingAmount);
  const remainingAmount =
    Number.isFinite(remaining) && remaining >= 0
      ? remaining
      : Math.max(0, totalPrice - advanceAmount);

  return { totalPrice, advanceAmount, remainingAmount };
};

let distributionCache = [];
let distributionHydrated = false;

const BhandiDistributionPage = () => {
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState(distributionCache);
  const [loading, setLoading] = useState(!distributionHydrated);
  const [saving, setSaving] = useState(false);
  const [editingDistributionId, setEditingDistributionId] = useState("");
  const [receivingDistributionId, setReceivingDistributionId] = useState("");
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

  const computedTotalPrice = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const quantity = toNonNegativeNumber(item.quantityGiven);
        return sum + quantity * resolveUnitPrice(item);
      }, 0),
    [form.items]
  );

  const remainingAmount = Math.max(
    0,
    computedTotalPrice - toNonNegativeNumber(form.advanceAmount)
  );

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

  const onItemSelectionChange = (index, selectedValue) => {
    setForm((prev) => {
      const updated = [...prev.items];
      const current = updated[index];

      let unitPrice = current.unitPrice;
      if (!selectedValue) {
        unitPrice = "";
      } else if (selectedValue !== CUSTOM_ITEM_OPTION) {
        unitPrice = String(toNonNegativeNumber(ITEM_UNIT_PRICE_MAP[selectedValue]));
      }

      updated[index] = {
        ...current,
        selectedItem: selectedValue,
        customItemName:
          selectedValue === CUSTOM_ITEM_OPTION ? current.customItemName : "",
        unitPrice,
      };

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

  const resetForm = () => {
    setForm(initialForm);
    setEditingDistributionId("");
  };

  const onEditDistribution = (record) => {
    const currentFunctionName = String(record.functionName || "").trim();
    const isKnownFunction = FUNCTION_NAME_OPTIONS.includes(currentFunctionName);
    const mappedItems = (record.items || []).map(buildFormItemFromRecord);
    const financials = getRecordFinancials(record);

    setForm({
      functionName: isKnownFunction
        ? currentFunctionName
        : CUSTOM_FUNCTION_OPTION,
      customFunctionName: isKnownFunction ? "" : currentFunctionName,
      personName: String(record.personName || ""),
      mobile: String(record.mobile || ""),
      eventDate: String(record.eventDate || ""),
      returnDate: String(record.returnDate || ""),
      advanceAmount: String(financials.advanceAmount),
      items: mappedItems.length > 0 ? mappedItems : [getInitialItem()],
    });
    setEditingDistributionId(record.id);
    setMessage({ type: "", text: "" });

    window.scrollTo({ top: 0, behavior: "smooth" });
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

      const normalizedItems = form.items
        .map((item) => {
          const itemName = resolveItemName(item);
          const quantityGiven = toNonNegativeNumber(item.quantityGiven);
          const unitPrice = resolveUnitPrice(item);
          return {
            itemName,
            quantityGiven,
            unitPrice,
            lineTotal: quantityGiven * unitPrice,
          };
        })
        .filter((item) => item.itemName && item.quantityGiven > 0);

      if (normalizedItems.length === 0) {
        throw new Error("Add at least one item with quantity.");
      }

      const totalPrice = normalizedItems.reduce(
        (sum, item) => sum + item.lineTotal,
        0
      );

      const advanceAmount = Number(form.advanceAmount);
      if (!Number.isFinite(advanceAmount) || advanceAmount < 0) {
        throw new Error("Enter a valid amount received.");
      }

      if (advanceAmount > totalPrice) {
        throw new Error("Amount received cannot exceed total amount.");
      }

      const payload = {
        functionName: resolvedFunctionName,
        personName: form.personName.trim(),
        mobile: form.mobile.trim(),
        eventDate: form.eventDate,
        returnDate: form.returnDate,
        items: normalizedItems,
        totalPrice,
        advanceAmount,
        remainingAmount: Math.max(0, totalPrice - advanceAmount),
      };

      const isEditing = Boolean(editingDistributionId);
      if (isEditing) {
        await updateDistribution(editingDistributionId, payload);
      } else {
        await createDistribution(payload);
      }

      resetForm();
      setMessage({
        type: "success",
        text: isEditing
          ? "Distribution updated successfully."
          : "Distribution record created.",
      });
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
      if (editingDistributionId === record.id) {
        resetForm();
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not delete distribution.",
      });
    } finally {
      setDeletingDistributionId("");
    }
  };

  const onReceivePending = async (record) => {
    const financials = getRecordFinancials(record);
    if (financials.remainingAmount <= 0) {
      setMessage({
        type: "error",
        text: "No pending balance left for this distribution.",
      });
      return;
    }

    const enteredAmount = window.prompt(
      `Pending balance is ${formatCurrency(financials.remainingAmount)}. Enter received amount:`
    );
    if (enteredAmount === null) return;

    const normalizedAmount = Number(String(enteredAmount).replaceAll(",", "").trim());
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setMessage({
        type: "error",
        text: "Enter a valid received amount.",
      });
      return;
    }

    try {
      setReceivingDistributionId(record.id);
      const updated = await receiveDistributionPendingPayment(
        record.id,
        normalizedAmount
      );
      setMessage({
        type: "success",
        text: `Pending received. New balance: ${formatCurrency(updated.remainingAmount)}.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not receive pending payment.",
      });
    } finally {
      setReceivingDistributionId("");
    }
  };

  return (
    <section>
      <SectionHeading
        title="Bhandi & Sahitya Distribution"
        subtitle="Record distributed material, track pending payments, and generate printable statements."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <form className="card space-y-3" onSubmit={onSubmit}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-maroon-800">
              {editingDistributionId
                ? "Edit Distribution Entry"
                : "New Distribution Entry"}
            </h3>
            {editingDistributionId ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetForm}
                disabled={saving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel Edit
              </button>
            ) : null}
          </div>
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
            <div>
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
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-sm font-semibold text-maroon-900">Item Distribution</h4>
              <button
                type="button"
                className="btn btn-ghost w-full sm:w-auto"
                onClick={addItemRow}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </button>
            </div>
            <p className="mb-2 text-xs text-maroon-700">
              Select an item from dropdown. Choose "Other" to type a custom item.
            </p>
            <div className="space-y-3">
              {form.items.map((item, index) => {
                const isDefaultItem =
                  item.selectedItem && item.selectedItem !== CUSTOM_ITEM_OPTION;
                const defaultUnitPrice = isDefaultItem
                  ? toNonNegativeNumber(ITEM_UNIT_PRICE_MAP[item.selectedItem])
                  : 0;
                const unitPrice = isDefaultItem
                  ? defaultUnitPrice
                  : toNonNegativeNumber(item.unitPrice);
                const quantity = toNonNegativeNumber(item.quantityGiven);
                const lineTotal = quantity * unitPrice;

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-maroon-200 bg-maroon-50/40 p-3 sm:p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-maroon-700">
                        Item {index + 1}
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost px-2 py-2"
                        onClick={() => removeItemRow(index)}
                        disabled={form.items.length === 1}
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="label">Item Name</label>
                        <select
                          className="input h-10 w-full"
                          value={item.selectedItem}
                          onChange={(event) =>
                            onItemSelectionChange(index, event.target.value)
                          }
                        >
                          <option value="">Select item</option>
                          {DEFAULT_DISTRIBUTION_ITEMS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          <option value={CUSTOM_ITEM_OPTION}>Other</option>
                        </select>
                        {item.selectedItem === CUSTOM_ITEM_OPTION ? (
                          <input
                            className="input mt-2 h-10 w-full"
                            type="text"
                            placeholder="Type custom item name"
                            value={item.customItemName}
                            onChange={(event) =>
                              updateItem(index, "customItemName", event.target.value)
                            }
                          />
                        ) : null}
                      </div>
                      <div>
                        <label className="label">Qty</label>
                        <input
                          className="input h-10 w-full"
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantityGiven}
                          onChange={(event) =>
                            updateItem(index, "quantityGiven", event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Unit Price</label>
                        <input
                          className="input h-10 w-full"
                          type="number"
                          min="0"
                          placeholder={isDefaultItem ? "Auto-filled" : "Enter rate"}
                          value={isDefaultItem ? String(unitPrice) : item.unitPrice}
                          readOnly={isDefaultItem}
                          onChange={(event) =>
                            updateItem(index, "unitPrice", event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Amount</label>
                        <div className="input flex h-10 w-full items-center bg-maroon-50/50">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gold-200 bg-gold-50 p-3">
            <h4 className="text-sm font-semibold text-maroon-900">Bill Summary</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-white p-3 text-sm text-maroon-900 ring-1 ring-gold-200">
                <p className="text-xs uppercase tracking-wide text-maroon-700">
                  Total Bill
                </p>
                <p className="mt-1 text-base font-semibold">
                  {formatCurrency(computedTotalPrice)}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 text-sm text-maroon-900 ring-1 ring-gold-200">
                <label className="label">Received (INR)</label>
                <input
                  className="input h-11"
                  type="number"
                  min="0"
                  value={form.advanceAmount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, advanceAmount: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="rounded-lg bg-white p-3 text-sm text-maroon-900 ring-1 ring-gold-200">
                <p className="text-xs uppercase tracking-wide text-maroon-700">
                  Pending
                </p>
                <p className="mt-1 text-base font-semibold">
                  {formatCurrency(remainingAmount)}
                </p>
              </div>
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
            {saving
              ? editingDistributionId
                ? "Updating Distribution..."
                : "Saving Distribution..."
              : editingDistributionId
                ? "Update Distribution"
                : "Save Distribution"}
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
            filteredRecords.map((record) => {
              const financials = getRecordFinancials(record);

              return (
                <article key={record.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
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
                        className="btn btn-ghost"
                        onClick={() => onEditDistribution(record)}
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </button>
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
                        className="btn btn-ghost"
                        onClick={() => onReceivePending(record)}
                        disabled={
                          receivingDistributionId === record.id ||
                          Number(financials.remainingAmount || 0) <= 0
                        }
                      >
                        <IndianRupee className="mr-2 h-4 w-4" />
                        {receivingDistributionId === record.id
                          ? "Saving..."
                          : Number(financials.remainingAmount || 0) <= 0
                            ? "No Pending"
                            : "Receive Pending"}
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

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-maroon-700">
                    <p>
                      <span className="font-semibold text-maroon-900">Total:</span>{" "}
                      {formatCurrency(financials.totalPrice)}
                    </p>
                    <p>
                      <span className="font-semibold text-maroon-900">Received:</span>{" "}
                      {formatCurrency(financials.advanceAmount)}
                    </p>
                    <p>
                      <span className="font-semibold text-maroon-900">Pending:</span>{" "}
                      {formatCurrency(financials.remainingAmount)}
                    </p>
                    <p>
                      <span className="font-semibold text-maroon-900">Items:</span>{" "}
                      {(record.items || []).length}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default BhandiDistributionPage;
