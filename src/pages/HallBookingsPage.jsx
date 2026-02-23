import { useEffect, useMemo, useState } from "react";
import { Download, IndianRupee, Save, Trash2 } from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import Loader from "../components/Loader";
import ReportFilters from "../components/ReportFilters";
import {
  BOOKING_STATUS_OPTIONS,
  EVENT_PURPOSE_OPTIONS,
} from "../utils/constants";
import { formatCurrency } from "../utils/format";
import { parseDateLabel, to12Hour, toMinutes } from "../utils/time";
import {
  createBooking,
  deleteBooking,
  receivePendingPayment,
  subscribeBookings,
  updateBookingStatus,
} from "../services/bookingService";
import { exportBookingBillPdf } from "../utils/pdf";

const CUSTOM_FUNCTION_OPTION = "__other_function__";

const initialForm = {
  functionName: "",
  customFunctionName: "",
  personName: "",
  mobile: "",
  address: "",
  eventDate: "",
  startTime24: "",
  endTime24: "",
  totalPrice: "",
  advanceAmount: "",
  status: "Confirmed",
};

const initialFilters = {
  date: "",
  personName: "",
  eventPurpose: "",
};

const toBookingLoadErrorMessage = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const rawMessage = String(error?.message || "");
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    code === "failed-precondition" ||
    normalizedMessage.includes("requires an index")
  ) {
    return "Could not load bookings right now. Missing Firestore index for this query.";
  }

  return rawMessage || "Could not load bookings.";
};

let hallBookingsCache = [];
let hallBookingsHydrated = false;

const HallBookingsPage = () => {
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState(initialFilters);
  const [bookings, setBookings] = useState(hallBookingsCache);
  const [loading, setLoading] = useState(!hallBookingsHydrated);
  const [saving, setSaving] = useState(false);
  const [receivingBookingId, setReceivingBookingId] = useState("");
  const [deletingBookingId, setDeletingBookingId] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const unsubscribe = subscribeBookings(
      (rows) => {
        hallBookingsCache = rows;
        hallBookingsHydrated = true;
        setBookings(rows);
        setLoading(false);
      },
      (error) => {
        hallBookingsHydrated = true;
        setLoading(false);
        setMessage({
          type: "error",
          text: toBookingLoadErrorMessage(error),
        });
      }
    );

    return unsubscribe;
  }, []);

  const remainingAmount = Math.max(
    0,
    Number(form.totalPrice || 0) - Number(form.advanceAmount || 0)
  );

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (filters.date && booking.eventDate !== filters.date) return false;
      if (
        filters.personName &&
        !String(booking.personName || "")
          .toLowerCase()
          .includes(filters.personName.trim().toLowerCase())
      ) {
        return false;
      }
      if (filters.eventPurpose && booking.eventPurpose !== filters.eventPurpose) {
        return false;
      }
      return true;
    });
  }, [bookings, filters]);

  const onFormValueChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const clearFeedback = () => setMessage({ type: "", text: "" });

  const onSubmit = async (event) => {
    event.preventDefault();
    clearFeedback();

    const isCustomFunction = form.functionName === CUSTOM_FUNCTION_OPTION;
    const resolvedFunctionName = isCustomFunction
      ? form.customFunctionName.trim()
      : form.functionName.trim();

    if (!resolvedFunctionName) {
      setMessage({
        type: "error",
        text: "Function name is required.",
      });
      return;
    }

    const startMinutes = toMinutes(form.startTime24);
    const endMinutes = toMinutes(form.endTime24);

    if (!form.startTime24 || !form.endTime24 || endMinutes <= startMinutes) {
      setMessage({
        type: "error",
        text: "Event end time must be after start time.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        functionName: resolvedFunctionName,
        personName: form.personName.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim(),
        eventPurpose: resolvedFunctionName,
        eventDate: form.eventDate,
        startTime: to12Hour(form.startTime24),
        endTime: to12Hour(form.endTime24),
        startMinutes,
        endMinutes,
        totalPrice: Number(form.totalPrice || 0),
        advanceAmount: Number(form.advanceAmount || 0),
        remainingAmount,
        status: form.status,
      };

      await createBooking(payload);
      setForm(initialForm);
      setMessage({ type: "success", text: "Booking created successfully." });
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
          : createError.message || "Could not save booking.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onStatusChange = async (bookingId, status) => {
    try {
      await updateBookingStatus(bookingId, status);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not update booking status.",
      });
    }
  };

  const onDeleteBooking = async (booking) => {
    const bookingLabel = booking.functionName || booking.personName || booking.id;
    const shouldDelete = window.confirm(
      `Delete booking "${bookingLabel}"? This action cannot be undone.`
    );
    if (!shouldDelete) return;

    try {
      setDeletingBookingId(booking.id);
      await deleteBooking(booking.id);
      setMessage({ type: "success", text: "Booking deleted successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not delete booking.",
      });
    } finally {
      setDeletingBookingId("");
    }
  };

  const onReceivePending = async (booking) => {
    const pendingAmount = Number(booking.remainingAmount || 0);
    if (pendingAmount <= 0) {
      setMessage({
        type: "error",
        text: "No pending balance left for this booking.",
      });
      return;
    }

    const enteredAmount = window.prompt(
      `Pending balance is ${formatCurrency(pendingAmount)}. Enter received amount:`
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
      setReceivingBookingId(booking.id);
      const updated = await receivePendingPayment(booking.id, normalizedAmount);
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
      setReceivingBookingId("");
    }
  };

  return (
    <section>
      <SectionHeading
        title="Hall Booking Management"
        subtitle="Create bookings, prevent overlap, and generate digital bills."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <form className="card space-y-3" onSubmit={onSubmit}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-maroon-800">
            New Booking
          </h3>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Function Name</label>
              <select
                className="input"
                value={form.functionName}
                onChange={(event) => {
                  const selectedValue = event.target.value;
                  onFormValueChange("functionName", selectedValue);
                  if (selectedValue !== CUSTOM_FUNCTION_OPTION) {
                    onFormValueChange("customFunctionName", "");
                  }
                }}
                required
              >
                <option value="">Select function</option>
                {EVENT_PURPOSE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value={CUSTOM_FUNCTION_OPTION}>Other</option>
              </select>
              {form.functionName === CUSTOM_FUNCTION_OPTION ? (
                <input
                  className="input mt-2"
                  placeholder="Type custom function name"
                  value={form.customFunctionName}
                  onChange={(event) =>
                    onFormValueChange("customFunctionName", event.target.value)
                  }
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
                  onFormValueChange("personName", event.target.value)
                }
                required
              />
            </div>
            <div>
              <label className="label">Mobile Number</label>
              <input
                className="input"
                value={form.mobile}
                onChange={(event) => onFormValueChange("mobile", event.target.value)}
                minLength={10}
                maxLength={10}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <textarea
                rows={2}
                className="input"
                value={form.address}
                onChange={(event) => onFormValueChange("address", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Event Date</label>
              <input
                className="input"
                type="date"
                value={form.eventDate}
                onChange={(event) => onFormValueChange("eventDate", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Booking Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(event) => onFormValueChange("status", event.target.value)}
              >
                {BOOKING_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Event Start Time</label>
              <input
                className="input"
                type="time"
                value={form.startTime24}
                onChange={(event) =>
                  onFormValueChange("startTime24", event.target.value)
                }
                required
              />
              {form.startTime24 ? (
                <p className="mt-1 text-xs text-maroon-600">
                  12 Hour Format: {to12Hour(form.startTime24)}
                </p>
              ) : null}
            </div>
            <div>
              <label className="label">Event End Time</label>
              <input
                className="input"
                type="time"
                value={form.endTime24}
                onChange={(event) => onFormValueChange("endTime24", event.target.value)}
                required
              />
              {form.endTime24 ? (
                <p className="mt-1 text-xs text-maroon-600">
                  12 Hour Format: {to12Hour(form.endTime24)}
                </p>
              ) : null}
            </div>
            <div>
              <label className="label">Total Price of Event (INR)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.totalPrice}
                onChange={(event) => onFormValueChange("totalPrice", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Advance Amount Received (INR)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.advanceAmount}
                onChange={(event) =>
                  onFormValueChange("advanceAmount", event.target.value)
                }
                required
              />
            </div>
          </div>

          <div className="rounded-xl bg-gold-50 p-3 text-sm text-maroon-900 ring-1 ring-gold-200">
            Remaining Balance:{" "}
            <span className="font-bold">{formatCurrency(remainingAmount)}</span>
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
            {saving ? "Saving Booking..." : "Save Booking"}
          </button>
        </form>

        <div>
          <ReportFilters
            filters={filters}
            onChange={(field, value) =>
              setFilters((prev) => ({ ...prev, [field]: value }))
            }
            onReset={() => setFilters(initialFilters)}
          />

          {loading ? (
            <Loader label="Loading bookings..." />
          ) : (
            <div className="space-y-3">
              {filteredBookings.length === 0 ? (
                <div className="card text-sm text-maroon-700">
                  No bookings found for selected filters.
                </div>
              ) : (
                filteredBookings.map((booking) => (
                  <article key={booking.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-maroon-900">
                          {booking.functionName}
                        </h3>
                        <p className="text-sm text-maroon-700">
                          {booking.personName} | {booking.mobile}
                        </p>
                      </div>
                      <select
                        className="input w-36"
                        value={booking.status}
                        onChange={(event) =>
                          onStatusChange(booking.id, event.target.value)
                        }
                      >
                        {BOOKING_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-maroon-700">
                      <p>
                        <span className="font-semibold text-maroon-900">Date:</span>{" "}
                        {parseDateLabel(booking.eventDate)}
                      </p>
                      <p>
                        <span className="font-semibold text-maroon-900">Function:</span>{" "}
                        {booking.functionName || booking.eventPurpose || "-"}
                      </p>
                      <p>
                        <span className="font-semibold text-maroon-900">Time:</span>{" "}
                        {booking.startTime} - {booking.endTime}
                      </p>
                      <p>
                        <span className="font-semibold text-maroon-900">Balance:</span>{" "}
                        {formatCurrency(booking.remainingAmount)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-accent"
                        onClick={() => exportBookingBillPdf(booking)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Generate Bill PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => onReceivePending(booking)}
                        disabled={
                          receivingBookingId === booking.id ||
                          Number(booking.remainingAmount || 0) <= 0
                        }
                      >
                        <IndianRupee className="mr-2 h-4 w-4" />
                        {receivingBookingId === booking.id
                          ? "Saving..."
                          : Number(booking.remainingAmount || 0) <= 0
                            ? "No Pending"
                            : "Receive Pending"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost text-rose-700 hover:bg-rose-50"
                        onClick={() => onDeleteBooking(booking)}
                        disabled={deletingBookingId === booking.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingBookingId === booking.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HallBookingsPage;

