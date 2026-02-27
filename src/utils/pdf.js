import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parseDateLabel } from "./time";

const HALL_TITLE = "SAWALI MANGALAM";
const HALL_SUBTITLE = "Hall For Weddings & Events";
const PDF_UNICODE_FONT = {
  family: "NotoSansDevanagari",
  fileName: "NotoSansDevanagari.ttf",
  url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf",
};

let unicodeFontBase64Promise = null;

const formatPdfCurrency = (value) => {
  const amount = Number(value || 0);
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

const toNonNegativeNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const getItemLineTotal = (item) => {
  const rawLineTotal = Number(item?.lineTotal);
  if (Number.isFinite(rawLineTotal) && rawLineTotal >= 0) {
    return rawLineTotal;
  }

  return (
    toNonNegativeNumber(item?.quantityGiven) * toNonNegativeNumber(item?.unitPrice)
  );
};

const getDistributionFinancials = (record) => {
  const calculatedTotal = (record.items || []).reduce(
    (sum, item) => sum + getItemLineTotal(item),
    0
  );

  const rawTotal = Number(record.totalPrice);
  const totalBill =
    Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : calculatedTotal;
  const received = toNonNegativeNumber(record.advanceAmount);

  const rawPending = Number(record.remainingAmount);
  const pending =
    Number.isFinite(rawPending) && rawPending >= 0
      ? rawPending
      : Math.max(0, totalBill - received);

  return { totalBill, received, pending };
};

const toPngDataUrl = (url) =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 760;
      canvas.height = image.naturalHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });

const arrayBufferToBase64 = (buffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  // Convert in chunks to avoid call stack overflow on large fonts.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode.apply(null, chunk);
  }

  return btoa(binary);
};

const getUnicodeFontBase64 = async () => {
  if (!unicodeFontBase64Promise) {
    unicodeFontBase64Promise = fetch(PDF_UNICODE_FONT.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Font fetch failed: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBufferToBase64)
      .catch(() => null);
  }

  return unicodeFontBase64Promise;
};

const ensureUnicodePdfFont = async (doc) => {
  if (doc.getFontList()?.[PDF_UNICODE_FONT.family]) {
    return PDF_UNICODE_FONT.family;
  }

  const fontBase64 = await getUnicodeFontBase64();
  if (!fontBase64) {
    return "helvetica";
  }

  doc.addFileToVFS(PDF_UNICODE_FONT.fileName, fontBase64);
  doc.addFont(PDF_UNICODE_FONT.fileName, PDF_UNICODE_FONT.family, "normal");
  doc.addFont(PDF_UNICODE_FONT.fileName, PDF_UNICODE_FONT.family, "bold");
  return PDF_UNICODE_FONT.family;
};

const applyHeader = async (doc, heading, subtitle, fontFamily = "helvetica") => {
  const logoData = await toPngDataUrl("/sawali-logo.svg");

  if (logoData) {
    doc.addImage(logoData, "PNG", 12, 8, 40, 25);
  }

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(16);
  doc.text(HALL_TITLE, 58, 16);
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(10);
  doc.text(HALL_SUBTITLE, 58, 22);
  doc.setDrawColor(143, 23, 54);
  doc.line(12, 36, 198, 36);
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(13);
  doc.text(heading, 14, 45);
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 14, 51);
};

export const exportBookingBillPdf = async (booking) => {
  const doc = new jsPDF();
  await applyHeader(
    doc,
    "Booking Payment Bill",
    `Generated: ${new Date().toLocaleString("en-IN")}`
  );

  autoTable(doc, {
    startY: 58,
    theme: "grid",
    headStyles: {
      fillColor: [143, 23, 54],
    },
    head: [["Field", "Value"]],
    body: [
      ["Booking ID", booking.bookingId || "-"],
      ["Function Name", booking.functionName || "-"],
      ["Person Name", booking.personName || "-"],
      ["Mobile", booking.mobile || "-"],
      ["Address", booking.address || "-"],
      ["Event Purpose", booking.eventPurpose || "-"],
      ["Event Date", parseDateLabel(booking.eventDate)],
      ["Event Time", `${booking.startTime} - ${booking.endTime}`],
      ["Status", booking.status || "-"],
      ["Total Amount", formatPdfCurrency(booking.totalPrice)],
      ["Advance Paid", formatPdfCurrency(booking.advanceAmount)],
      ["Remaining Balance", formatPdfCurrency(booking.remainingAmount)],
    ],
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [255, 248, 248],
    },
  });

  const datePart = booking.eventDate || new Date().toISOString().split("T")[0];
  doc.save(`hall-bill-${datePart}-${booking.personName || "customer"}.pdf`);
};

export const exportDistributionStatementPdf = async (record) => {
  const doc = new jsPDF();
  const fontFamily = await ensureUnicodePdfFont(doc);

  await applyHeader(
    doc,
    "Bhandi & Sahitya Distribution Statement",
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    fontFamily
  );

  autoTable(doc, {
    startY: 58,
    theme: "grid",
    headStyles: {
      fillColor: [143, 23, 54],
      font: fontFamily,
      fontStyle: "bold",
    },
    head: [["Personal & Function Details", "Information"]],
    body: [
      ["Person Name", record.personName || "-"],
      ["Mobile Number", record.mobile || "-"],
      ["Function Name", record.functionName || "-"],
      ["Event Date", parseDateLabel(record.eventDate)],
      ["Return Date", parseDateLabel(record.returnDate)],
      ["Distribution ID", record.distributionId || record.id || "-"],
    ],
    styles: {
      font: fontFamily,
      fontSize: 10,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [255, 248, 248],
    },
  });

  const itemsStartY = (doc.lastAutoTable?.finalY || 84) + 6;
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(11);
  doc.text("Item Details", 14, itemsStartY);

  autoTable(doc, {
    startY: itemsStartY + 3,
    theme: "grid",
    headStyles: {
      fillColor: [143, 23, 54],
      font: fontFamily,
      fontStyle: "bold",
    },
    head: [["Item Name", "Quantity", "Unit Price", "Amount"]],
    body: (record.items || []).map((item) => {
      const quantity = toNonNegativeNumber(item?.quantityGiven);
      const unitPrice = toNonNegativeNumber(item?.unitPrice);
      const lineTotal = getItemLineTotal(item);

      return [
        item.itemName || "-",
        quantity,
        formatPdfCurrency(unitPrice),
        formatPdfCurrency(lineTotal),
      ];
    }),
    styles: {
      font: fontFamily,
      fontSize: 10,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [255, 248, 248],
    },
  });

  const totals = getDistributionFinancials(record);
  const summaryStartY = (doc.lastAutoTable?.finalY || itemsStartY + 30) + 6;
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(11);
  doc.text("Bill Summary", 14, summaryStartY);

  autoTable(doc, {
    startY: summaryStartY + 3,
    theme: "grid",
    headStyles: {
      fillColor: [143, 23, 54],
      font: fontFamily,
      fontStyle: "bold",
    },
    head: [["Bill Section", "Amount"]],
    body: [
      ["Total Bill", formatPdfCurrency(totals.totalBill)],
      ["Received", formatPdfCurrency(totals.received)],
      ["Pending", formatPdfCurrency(totals.pending)],
    ],
    styles: {
      font: fontFamily,
      fontSize: 10,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [255, 248, 248],
    },
  });

  const datePart = record.eventDate || new Date().toISOString().split("T")[0];
  doc.save(`distribution-${datePart}-${record.personName || "customer"}.pdf`);
};
