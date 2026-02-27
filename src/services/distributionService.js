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
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const DISTRIBUTION_COLLECTION = "bhandiDistribution";
const PAYMENT_COLLECTION = "payments";

const toDistributionModel = (snap) => ({
  id: snap.id,
  ...snap.data(),
});

const distributionQuery = query(
  collection(db, DISTRIBUTION_COLLECTION),
  orderBy("eventDate", "desc")
);

const stableHash = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const slugify = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";

  const asciiSlug = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return asciiSlug || `item-${stableHash(normalized)}`;
};

const syncItemCatalog = async (items) => {
  const tasks = items.map((item) => {
    const itemName = item.itemName?.trim();
    if (!itemName) return null;

    const itemDocId = slugify(itemName);
    if (!itemDocId) return null;
    return setDoc(
      doc(db, "items", itemDocId),
      {
        itemName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return Promise.all(tasks.filter(Boolean));
};

const sanitizeDistributionItems = (items) =>
  (items || [])
    .map((item) => {
      const quantityGiven = Number(item.quantityGiven);
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal = Number(item.lineTotal || quantityGiven * unitPrice);
      return {
        itemName: String(item.itemName || "").trim(),
        quantityGiven,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        lineTotal: Number.isFinite(lineTotal) && lineTotal >= 0 ? lineTotal : 0,
      };
    })
    .filter((item) => item.itemName && item.quantityGiven > 0);

const getAmounts = (payload, items) => {
  const computedTotal = items.reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0
  );
  const totalPrice = Number(payload.totalPrice ?? computedTotal);
  const advanceAmount = Number(payload.advanceAmount || 0);
  const normalizedTotal = Number.isFinite(totalPrice) && totalPrice >= 0 ? totalPrice : 0;
  const normalizedAdvance =
    Number.isFinite(advanceAmount) && advanceAmount >= 0 ? advanceAmount : 0;

  return {
    totalPrice: normalizedTotal,
    advanceAmount: normalizedAdvance,
    remainingAmount: Math.max(0, normalizedTotal - normalizedAdvance),
  };
};

const getDistributionPaymentQuery = (distributionId) =>
  query(
    collection(db, PAYMENT_COLLECTION),
    where("distributionId", "==", distributionId)
  );

const upsertDistributionPayment = async ({
  distributionId,
  personName,
  eventDate,
  totalPrice,
  advanceAmount,
  remainingAmount,
}) => {
  const paymentQuery = getDistributionPaymentQuery(distributionId);
  const paymentSnap = await getDocs(paymentQuery);

  if (paymentSnap.empty) {
    await addDoc(collection(db, PAYMENT_COLLECTION), {
      paymentType: "distribution",
      distributionId,
      personName: personName || "",
      eventDate: eventDate || "",
      totalPrice: Number(totalPrice || 0),
      advanceAmount: Number(advanceAmount || 0),
      remainingAmount: Number(remainingAmount || 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await Promise.all(
    paymentSnap.docs.map((paymentDoc) =>
      updateDoc(paymentDoc.ref, {
        paymentType: "distribution",
        personName: personName || "",
        eventDate: eventDate || "",
        totalPrice: Number(totalPrice || 0),
        advanceAmount: Number(advanceAmount || 0),
        remainingAmount: Number(remainingAmount || 0),
        updatedAt: serverTimestamp(),
      })
    )
  );
};

export const subscribeDistributions = (callback, onError) =>
  onSnapshot(
    distributionQuery,
    (snapshot) => callback(snapshot.docs.map(toDistributionModel)),
    onError
  );

export const createDistribution = async (payload) => {
  const cleanedItems = sanitizeDistributionItems(payload.items);
  const { totalPrice, advanceAmount, remainingAmount } = getAmounts(
    payload,
    cleanedItems
  );

  const distributionRef = doc(collection(db, DISTRIBUTION_COLLECTION));
  await setDoc(distributionRef, {
    ...payload,
    distributionId: distributionRef.id,
    items: cleanedItems,
    totalPrice,
    advanceAmount,
    remainingAmount,
    createdAt: serverTimestamp(),
  });

  await upsertDistributionPayment({
    distributionId: distributionRef.id,
    personName: payload.personName,
    eventDate: payload.eventDate,
    totalPrice,
    advanceAmount,
    remainingAmount,
  });

  // Item catalog sync should not block the primary distribution save.
  try {
    await syncItemCatalog(cleanedItems);
  } catch (error) {
    console.warn("Item catalog sync skipped:", error);
  }

  return distributionRef.id;
};

export const updateDistribution = async (distributionId, payload) => {
  const cleanedItems = sanitizeDistributionItems(payload.items);
  const { totalPrice, advanceAmount, remainingAmount } = getAmounts(
    payload,
    cleanedItems
  );

  await updateDoc(doc(db, DISTRIBUTION_COLLECTION, distributionId), {
    ...payload,
    items: cleanedItems,
    totalPrice,
    advanceAmount,
    remainingAmount,
    updatedAt: serverTimestamp(),
  });

  await upsertDistributionPayment({
    distributionId,
    personName: payload.personName,
    eventDate: payload.eventDate,
    totalPrice,
    advanceAmount,
    remainingAmount,
  });

  try {
    await syncItemCatalog(cleanedItems);
  } catch (error) {
    console.warn("Item catalog sync skipped:", error);
  }
};

export const receiveDistributionPendingPayment = async (
  distributionId,
  receivedAmount
) => {
  const amount = Number(receivedAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid received amount.");
  }

  const distributionRef = doc(db, DISTRIBUTION_COLLECTION, distributionId);
  const distributionSnap = await getDoc(distributionRef);
  if (!distributionSnap.exists()) {
    throw new Error("Distribution record not found.");
  }

  const distribution = distributionSnap.data();
  const totalPrice = Number(distribution.totalPrice || 0);
  const currentAdvance = Number(distribution.advanceAmount || 0);
  const currentRemaining = Number(
    distribution.remainingAmount ?? Math.max(0, totalPrice - currentAdvance)
  );

  if (currentRemaining <= 0) {
    throw new Error("No pending balance for this distribution.");
  }

  if (amount > currentRemaining) {
    throw new Error("Received amount cannot exceed pending balance.");
  }

  const nextAdvance = currentAdvance + amount;
  const nextRemaining = Math.max(0, totalPrice - nextAdvance);

  await updateDoc(distributionRef, {
    advanceAmount: nextAdvance,
    remainingAmount: nextRemaining,
    updatedAt: serverTimestamp(),
  });

  await upsertDistributionPayment({
    distributionId,
    personName: distribution.personName || "",
    eventDate: distribution.eventDate || "",
    totalPrice,
    advanceAmount: nextAdvance,
    remainingAmount: nextRemaining,
  });

  return {
    advanceAmount: nextAdvance,
    remainingAmount: nextRemaining,
  };
};

export const deleteDistribution = async (distributionId) => {
  const paymentQuery = getDistributionPaymentQuery(distributionId);
  const paymentSnap = await getDocs(paymentQuery);

  const deleteTasks = paymentSnap.docs.map((paymentDoc) => deleteDoc(paymentDoc.ref));
  deleteTasks.push(deleteDoc(doc(db, DISTRIBUTION_COLLECTION, distributionId)));

  await Promise.all(deleteTasks);
};
