import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const DISTRIBUTION_COLLECTION = "bhandiDistribution";

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

export const subscribeDistributions = (callback, onError) =>
  onSnapshot(
    distributionQuery,
    (snapshot) => callback(snapshot.docs.map(toDistributionModel)),
    onError
  );

export const createDistribution = async (payload) => {
  const cleanedItems = (payload.items || [])
    .map((item) => ({
      itemName: String(item.itemName || "").trim(),
      quantityGiven: Number(item.quantityGiven),
    }))
    .filter((item) => item.itemName && item.quantityGiven > 0);

  const distributionRef = doc(collection(db, DISTRIBUTION_COLLECTION));
  await setDoc(distributionRef, {
    ...payload,
    distributionId: distributionRef.id,
    items: cleanedItems,
    createdAt: serverTimestamp(),
  });

  // Item catalog sync should not block the primary distribution save.
  try {
    await syncItemCatalog(cleanedItems);
  } catch (error) {
    console.warn("Item catalog sync skipped:", error);
  }

  return distributionRef.id;
};

export const deleteDistribution = async (distributionId) => {
  await deleteDoc(doc(db, DISTRIBUTION_COLLECTION, distributionId));
};
