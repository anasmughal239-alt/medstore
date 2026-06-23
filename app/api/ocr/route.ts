import { NextRequest, NextResponse } from "next/server";

const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`;

function parseVisionText(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: { name: string; quantity: number }[] = [];

  const skipWords = ["bill", "date", "rep", "store", "tel", "received", "signature", "thank", "total", "amount", "medicine", "qty", "price"];

  // Google Vision puts each column on its own line:
  // "Panadol Extra" → "24" → "Rs. 480"
  // Walk lines: when we see a medicine name, look ahead for a quantity number
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (skipWords.some((w) => line.toLowerCase().includes(w))) { i++; continue; }
    if (/^Rs\.?\s*[\d,]+$/i.test(line)) { i++; continue; }
    if (/^\d+$/.test(line)) { i++; continue; }

    // Check same-line format: "Panadol Extra  24"
    const sameLineMatch = line.match(/^([A-Za-z][A-Za-z0-9\s\-\.\/]+?)\s{2,}(\d+)\s*$/);
    if (sameLineMatch) {
      const qty = parseInt(sameLineMatch[2]);
      if (qty > 0 && qty < 5000) {
        items.push({ name: sameLineMatch[1].trim(), quantity: qty });
      }
      i++;
      continue;
    }

    // Multi-line format: name on this line, qty on next 1-2 lines
    if (/^[A-Za-z]/.test(line) && line.length > 2) {
      for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
        const next = lines[j].trim();
        if (/^\d+$/.test(next)) {
          const qty = parseInt(next);
          if (qty > 0 && qty < 5000) {
            items.push({ name: line.trim(), quantity: qty });
          }
          i = j;
          break;
        }
      }
    }

    i++;
  }

  return items;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    if (!file) return NextResponse.json({ error: "No image" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const response = await fetch(VISION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        }],
      }),
    });

    const data = await response.json();
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || "";

    if (!fullText) {
      return NextResponse.json({ items: [], rawText: "" });
    }

    console.log("Vision raw text:", fullText.slice(0, 500));
    const items = parseVisionText(fullText);
    console.log("Parsed items:", items);
    return NextResponse.json({ items, rawText: fullText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
