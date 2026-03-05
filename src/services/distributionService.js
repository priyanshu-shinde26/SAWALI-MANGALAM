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
import { db, firebaseConfigReady, firebaseMissingKeys } from "./firebase";

const DISTRIBUTION_COLLECTION = "bhandiDistribution";
const PAYMENT_COLLECTION = "payments";

const getFirebaseConfigError = () =>
  new Error(
    `Firebase is not configured. Missing .env keys: ${firebaseMissingKeys.join(
      ", "
    )}.`
  );

const getDb = () => {
  if (!db || !firebaseConfigReady) {
    throw getFirebaseConfigError();
  }

  return db;
};

const toDistributionModel = (snap) => ({
  ...snap.data(),
  id: snap.id,
});

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
  const database = getDb();

  const tasks = items.map((item) => {
    const itemName = item.itemName?.trim();
    if (!itemName) return null;

    const itemDocId = slugify(itemName);
    if (!itemDocId) return null;
    return setDoc(
      doc(database, "items", itemDocId),
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
    collection(getDb(), PAYMENT_COLLECTION),
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
  (() => {
    try {
      const database = getDb();
      const distributionQuery = query(
        collection(database, DISTRIBUTION_COLLECTION),
        orderBy("eventDate", "desc")
      );

      return onSnapshot(
        distributionQuery,
        (snapshot) => callback(snapshot.docs.map(toDistributionModel)),
        onError
      );
    } catch (error) {
      callback([]);
      if (onError) onError(error);
      return () => {};
    }
  })();

export const createDistribution = async (payload) => {
  const database = getDb();

  const cleanedItems = sanitizeDistributionItems(payload.items);
  const { totalPrice, advanceAmount, remainingAmount } = getAmounts(
    payload,
    cleanedItems
  );

  const distributionRef = doc(collection(database, DISTRIBUTION_COLLECTION));
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
  const database = getDb();

  const cleanedItems = sanitizeDistributionItems(payload.items);
  const { totalPrice, advanceAmount, remainingAmount } = getAmounts(
    payload,
    cleanedItems
  );

  await updateDoc(doc(database, DISTRIBUTION_COLLECTION, distributionId), {
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
  const database = getDb();

  const amount = Number(receivedAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid received amount.");
  }

  const distributionRef = doc(database, DISTRIBUTION_COLLECTION, distributionId);
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
  const database = getDb();

  const normalizedDistributionId = String(distributionId || "").trim();
  if (!normalizedDistributionId) {
    throw new Error("Distribution ID is missing.");
  }

  const distributionRef = doc(database, DISTRIBUTION_COLLECTION, normalizedDistributionId);
  const distributionSnap = await getDoc(distributionRef);

  const distributionIdCandidates = [normalizedDistributionId];
  if (distributionSnap.exists()) {
    const legacyDistributionId = String(
      distributionSnap.data().distributionId || ""
    ).trim();
    if (legacyDistributionId && legacyDistributionId !== normalizedDistributionId) {
      distributionIdCandidates.push(legacyDistributionId);
    }
  }

  const paymentSnaps = await Promise.all(
    distributionIdCandidates.map((candidateId) =>
      getDocs(getDistributionPaymentQuery(candidateId))
    )
  );

  const paymentRefsByPath = new Map();
  paymentSnaps.forEach((snapshot) => {
    snapshot.docs.forEach((paymentDoc) => {
      paymentRefsByPath.set(paymentDoc.ref.path, paymentDoc.ref);
    });
  });

  const deleteTasks = Array.from(paymentRefsByPath.values()).map((paymentRef) =>
    deleteDoc(paymentRef)
  );
  deleteTasks.push(deleteDoc(distributionRef));

  await Promise.all(deleteTasks);
};
