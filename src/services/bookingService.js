import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { overlaps } from "../utils/time";

const BOOKING_COLLECTION = "hallBookings";

const toBookingModel = (snap) => ({
  id: snap.id,
  ...snap.data(),
});

const bookingQuery = query(
  collection(db, BOOKING_COLLECTION),
  orderBy("eventDate", "desc")
);

const toMinutesFrom12Hour = (timeLabel) => {
  const match = String(timeLabel || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return 0;

  const [, hourRaw, minuteRaw, meridiemRaw] = match;
  let hour = Number(hourRaw) % 12;
  const minute = Number(minuteRaw);
  const meridiem = meridiemRaw.toUpperCase();
  if (meridiem === "PM") hour += 12;
  return hour * 60 + minute;
};

const sortBookings = (rows) =>
  [...rows].sort((a, b) => {
    const dateA = String(a.eventDate || "");
    const dateB = String(b.eventDate || "");
    const dateDiff = dateB.localeCompare(dateA);
    if (dateDiff !== 0) return dateDiff;

    const startA = Number(a.startMinutes ?? toMinutesFrom12Hour(a.startTime));
    const startB = Number(b.startMinutes ?? toMinutesFrom12Hour(b.startTime));
    if (startA !== startB) return startA - startB;

    return String(a.id || "").localeCompare(String(b.id || ""));
  });

export const subscribeBookings = (callback, onError) =>
  onSnapshot(
    bookingQuery,
    (snapshot) => callback(sortBookings(snapshot.docs.map(toBookingModel))),
    onError
  );

export const hasBookingConflict = async ({
  eventDate,
  startMinutes,
  endMinutes,
  ignoreId,
}) => {
  const q = query(
    collection(db, BOOKING_COLLECTION),
    where("eventDate", "==", eventDate)
  );
  const snap = await getDocs(q);

  return snap.docs.some((docSnap) => {
    if (ignoreId && docSnap.id === ignoreId) return false;

    const data = docSnap.data();
    if (data.status === "Cancelled") return false;

    const existingStart = Number(
      data.startMinutes ?? toMinutesFrom12Hour(data.startTime)
    );
    const existingEnd = Number(data.endMinutes ?? toMinutesFrom12Hour(data.endTime));
    return overlaps(startMinutes, endMinutes, existingStart, existingEnd);
  });
};

export const createBooking = async (payload) => {
  const conflict = await hasBookingConflict(payload);
  if (conflict) {
    throw new Error("Hall is already booked for the selected date/time slot.");
  }

  const remainingAmount = Math.max(
    0,
    Number(payload.totalPrice || 0) - Number(payload.advanceAmount || 0)
  );

  const bookingRef = await addDoc(collection(db, BOOKING_COLLECTION), {
    ...payload,
    remainingAmount,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, BOOKING_COLLECTION, bookingRef.id), {
    bookingId: bookingRef.id,
  });

  await addDoc(collection(db, "payments"), {
    bookingId: bookingRef.id,
    personName: payload.personName,
    eventDate: payload.eventDate,
    totalPrice: Number(payload.totalPrice || 0),
    advanceAmount: Number(payload.advanceAmount || 0),
    remainingAmount,
    createdAt: serverTimestamp(),
  });

  return bookingRef.id;
};

export const updateBookingStatus = async (bookingId, status) => {
  await updateDoc(doc(db, BOOKING_COLLECTION, bookingId), { status });
};

export const receivePendingPayment = async (bookingId, receivedAmount) => {
  const amount = Number(receivedAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid received amount.");
  }

  const bookingRef = doc(db, BOOKING_COLLECTION, bookingId);
  const bookingSnap = await getDoc(bookingRef);
  if (!bookingSnap.exists()) {
    throw new Error("Booking not found.");
  }

  const booking = bookingSnap.data();
  const currentRemaining = Number(booking.remainingAmount || 0);
  if (currentRemaining <= 0) {
    throw new Error("No pending balance for this booking.");
  }

  if (amount > currentRemaining) {
    throw new Error("Received amount cannot exceed pending balance.");
  }

  const nextAdvance = Number(booking.advanceAmount || 0) + amount;
  const nextRemaining = Math.max(0, currentRemaining - amount);

  const bookingUpdatePayload = {
    advanceAmount: nextAdvance,
    remainingAmount: nextRemaining,
    updatedAt: serverTimestamp(),
  };

  if (nextRemaining === 0 && booking.status !== "Cancelled") {
    bookingUpdatePayload.status = "Completed";
  }

  await updateDoc(bookingRef, bookingUpdatePayload);

  const paymentQuery = query(
    collection(db, "payments"),
    where("bookingId", "==", bookingId)
  );
  const paymentSnap = await getDocs(paymentQuery);

  if (paymentSnap.empty) {
    await addDoc(collection(db, "payments"), {
      bookingId,
      personName: booking.personName || "",
      eventDate: booking.eventDate || "",
      totalPrice: Number(booking.totalPrice || 0),
      advanceAmount: nextAdvance,
      remainingAmount: nextRemaining,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await Promise.all(
      paymentSnap.docs.map((paymentDoc) =>
        updateDoc(paymentDoc.ref, {
          advanceAmount: nextAdvance,
          remainingAmount: nextRemaining,
          updatedAt: serverTimestamp(),
        })
      )
    );
  }

  return {
    advanceAmount: nextAdvance,
    remainingAmount: nextRemaining,
  };
};

export const deleteBooking = async (bookingId) => {
  const bookingRef = doc(db, BOOKING_COLLECTION, bookingId);

  const paymentQuery = query(
    collection(db, "payments"),
    where("bookingId", "==", bookingId)
  );
  const paymentSnap = await getDocs(paymentQuery);

  const deleteTasks = paymentSnap.docs.map((paymentDoc) => deleteDoc(paymentDoc.ref));
  deleteTasks.push(deleteDoc(bookingRef));

  await Promise.all(deleteTasks);
};
