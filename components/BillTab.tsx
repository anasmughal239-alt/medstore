"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Upload, CheckCircle, Loader, Wand2 } from "lucide-react";

type ParsedItem = {
  name: string;
  quantity: number;
};


export default function BillTab() {
  const supabase = createClient();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [repName, setRepName] = useState("");
  const [pharmaCompany, setPharmaCompany] = useState("");
  const [saved, setSaved] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setParsedItems([]);
    setSaved(false);
  }

  async function runOcr() {
    if (!image) return;
    setLoading(true);
    setOcrProgress("Reading bill...");

    try {
      const formData = new FormData();
      formData.append("image", image);

      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (data.items && data.items.length > 0) {
        setParsedItems(data.items);
      } else {
        setParsedItems([{ name: "", quantity: 0 }]);
      }
    } catch (err) {
      setParsedItems([{ name: "", quantity: 0 }]);
    }

    setOcrProgress("");
    setLoading(false);
  }

  function addManualItem() {
    setParsedItems([...parsedItems, { name: "", quantity: 0 }]);
  }

  function updateItem(index: number, field: keyof ParsedItem, value: string | number) {
    const updated = [...parsedItems];
    updated[index] = { ...updated[index], [field]: value };
    setParsedItems(updated);
  }

  function removeItem(index: number) {
    setParsedItems(parsedItems.filter((_, i) => i !== index));
  }

  async function saveBill() {
    if (parsedItems.length === 0) return;
    setLoading(true);
    setOcrProgress("Saving...");

    const { data: bill } = (await supabase
      .from("bills")
      .insert({
        pharma_company: pharmaCompany || null,
        rep_name: repName || null,
        bill_date: new Date().toISOString().split("T")[0],
      } as any)
      .select()
      .single()) as any;

    if (!bill) { setLoading(false); setOcrProgress(""); return; }

    for (const item of parsedItems) {
      if (!item.name.trim() || !item.quantity) continue;

      let { data: med } = await supabase
        .from("medicines")
        .select("id")
        .ilike("name", item.name.trim())
        .single();

      if (!med) {
        const { data: newMed } = await supabase
          .from("medicines")
          .insert({ name: item.name.trim(), pharma_company: pharmaCompany || null } as any)
          .select()
          .single();
        med = newMed;
      }

      if (!med) continue;

      await supabase.from("bill_items").insert({
        bill_id: bill.id,
        medicine_id: med.id,
        quantity_received: item.quantity,
      } as any);

      const { data: inv } = await supabase
        .from("inventory")
        .select("id, quantity_current")
        .eq("medicine_id", med.id)
        .single();

      if (inv) {
        await supabase.from("inventory").update({
          quantity_current: inv.quantity_current + item.quantity,
          last_updated: new Date().toISOString(),
        }).eq("id", inv.id);
      } else {
        await supabase.from("inventory").insert({
          medicine_id: med.id,
          quantity_current: item.quantity,
        } as any);
      }
    }

    setLoading(false);
    setOcrProgress("");
    setSaved(true);
    setParsedItems([]);
    setImage(null);
    setPreview(null);
    setRepName("");
    setPharmaCompany("");
  }

  if (saved) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-64 gap-4">
        <CheckCircle size={56} className="text-green-500" />
        <p className="text-lg font-semibold text-gray-800">Stock Updated!</p>
        <p className="text-sm text-gray-500">Inventory has been updated with the new stock</p>
        <button
          onClick={() => setSaved(false)}
          className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm"
        >
          Add Another Bill
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-sm text-blue-800 font-medium">Upload Rep's Delivery Bill</p>
        <p className="text-xs text-blue-600 mt-1">Take a photo — OCR will read it automatically</p>
      </div>

      <div className="space-y-2">
        <input
          placeholder="Rep name (optional)"
          value={repName}
          onChange={(e) => setRepName(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          placeholder="Company name (e.g. GSK)"
          value={pharmaCompany}
          onChange={(e) => setPharmaCompany(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Image Upload */}
      <label className="block">
        <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          preview ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-blue-400"
        }`}>
          {preview ? (
            <img src={preview} alt="Bill" className="max-h-48 mx-auto rounded-lg object-contain" />
          ) : (
            <>
              <Upload size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">Tap to take a photo or upload bill</p>
              <p className="text-xs text-gray-400 mt-1">Use your camera or photo library</p>
            </>
          )}
        </div>
        <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
      </label>

      {/* OCR button */}
      {image && parsedItems.length === 0 && !loading && (
        <button
          onClick={runOcr}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm"
        >
          <Wand2 size={18} />
          Read Bill Automatically
        </button>
      )}

      {/* OCR progress */}
      {loading && ocrProgress && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <Loader size={16} className="animate-spin text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">{ocrProgress}</p>
        </div>
      )}

      {/* Items List */}
      {parsedItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Medicines from bill:</p>
            <p className="text-xs text-gray-400">Review & correct if needed</p>
          </div>
          {parsedItems.map((item, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
              <input
                placeholder="Medicine name"
                value={item.name}
                onChange={(e) => updateItem(i, "name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Quantity received"
                  value={item.quantity || ""}
                  onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeItem(i)} className="px-3 py-2 bg-red-100 text-red-500 rounded-lg text-sm">✕</button>
              </div>
            </div>
          ))}
          <button
            onClick={addManualItem}
            className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm"
          >
            + Add another medicine
          </button>
          <button
            onClick={saveBill}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm disabled:opacity-60"
          >
            {loading ? <Loader size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            Update Stock
          </button>
        </div>
      )}
    </div>
  );
}
