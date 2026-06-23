export type ParsedBarcode = {
  type: "gs1" | "ean13" | "unknown";
  rawCode: string;
  medicineName?: string;
  batchNumber?: string;
  expiryDate?: string;
  gtin?: string;
};

function formatExpiryDate(raw: string): string {
  // raw = YYMMDD
  const yy = raw.slice(0, 2);
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6) || "01";
  return `20${yy}-${mm}-${dd}`;
}

function extractMedicineName(raw: string): string {
  // Strip trailing price like "Rs.545.00" or "Rs 545"
  const stripped = raw.replace(/Rs\.?\s*[\d,]+\.?\d*/gi, "").trim();
  // Insert spaces: "Nebix5mgTab20s" → "Nebix 5mg Tab 20s"
  return stripped
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGS1(code: string): ParsedBarcode | null {
  if (!code.startsWith("01") || code.length < 16) return null;

  let pos = 0;
  let gtin = "";
  let expiry = "";
  let batch = "";
  let medicineName = "";

  while (pos < code.length) {
    const remaining = code.slice(pos);

    if (remaining.startsWith("01") && gtin === "") {
      gtin = code.slice(pos + 2, pos + 16);
      pos += 16;
    } else if (remaining.startsWith("17")) {
      expiry = formatExpiryDate(code.slice(pos + 2, pos + 8));
      pos += 8;
    } else if (remaining.startsWith("10")) {
      pos += 2;
      // Batch ends at next known AI (17, 21, 240) or end of string
      const match = code.slice(pos).match(/^(.*?)(17|21|240)(.*)$/);
      if (match) {
        batch = match[1];
        pos += match[1].length;
      } else {
        batch = code.slice(pos);
        pos = code.length;
      }
    } else if (remaining.startsWith("240")) {
      pos += 3;
      medicineName = extractMedicineName(code.slice(pos));
      pos = code.length;
    } else {
      // Unknown AI — skip one char and keep trying
      pos++;
    }
  }

  if (!gtin) return null;

  return {
    type: "gs1",
    rawCode: code,
    gtin,
    medicineName: medicineName || undefined,
    batchNumber: batch || undefined,
    expiryDate: expiry || undefined,
  };
}

export function parseBarcode(code: string): ParsedBarcode {
  // Try GS1 DataMatrix first
  const gs1 = parseGS1(code);
  if (gs1) return gs1;

  // EAN-13: exactly 13 digits
  if (/^\d{13}$/.test(code)) {
    return { type: "ean13", rawCode: code };
  }

  // EAN-8 or other numeric
  if (/^\d{8,14}$/.test(code)) {
    return { type: "ean13", rawCode: code };
  }

  return { type: "unknown", rawCode: code };
}
