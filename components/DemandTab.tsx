"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Trash2, CheckCircle, Search, ScanLine } from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { parseBarcode } from "@/utils/parseBarcode";

type DemandItem = {
  id: string;
  status: string;
  created_at: string;
  medicines: {
    id: string;
    name: string;
    pharma_company: string | null;
    unit: string;
  };
};

type Medicine = {
  id: string;
  name: string;
  pharma_company: string | null;
  unit: string;
};

type UnknownBarcode = {
  rawCode: string;
  suggestedName: string;
  expiryDate?: string;
  batchNumber?: string;
};

export default function DemandTab() {
  const supabase = createClient();
  const [demandList, setDemandList] = useState<DemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<UnknownBarcode | null>(null);
  const [newMedName, setNewMedName] = useState("");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { fetchDemand(); }, []);

  async function fetchDemand() {
    setLoading(true);
    const { data } = await supabase
      .from("demand_list")
      .select(`*, medicines(*)`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setDemandList(data as DemandItem[]);
    setLoading(false);
  }

  function showFeedback(msg: string, ok: boolean) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3500);
  }

  async function searchMedicines(query: string) {
    if (!query.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("medicines")
      .select("id, name, pharma_company, unit")
      .ilike("name", `%${query}%`)
      .limit(5);
    if (data) setSearchResults(data);
  }

  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchMedicines(val), 300);
  }

  async function addToDemand(medicine: Medicine) {
    const existing = demandList.find((d) => d.medicines?.id === medicine.id);
    if (existing) {
      setSearch(""); setSearchResults([]);
      showFeedback(`${medicine.name} is already in the demand list`, false);
      return;
    }
    await supabase.from("demand_list").insert({ medicine_id: medicine.id, status: "pending" });
    setSearch(""); setSearchResults([]);
    showFeedback(`✓ ${medicine.name} added to demand`, true);
    fetchDemand();
  }

  async function handleBarcodeScan(rawCode: string) {
    setShowScanner(false);
    const parsed = parseBarcode(rawCode);

    if (parsed.type === "gs1" && parsed.medicineName) {
      // GS1 DataMatrix — has medicine name embedded
      // Try to find existing medicine by name
      const { data: existing } = await supabase
        .from("medicines")
        .select("id, name, pharma_company, unit")
        .ilike("name", `%${parsed.medicineName.split(" ")[0]}%`)
        .limit(1)
        .single();

      if (existing) {
        await addToDemand(existing);
      } else {
        // New medicine from GS1 — pre-fill name from code
        setUnknownBarcode({
          rawCode,
          suggestedName: parsed.medicineName,
          expiryDate: parsed.expiryDate,
          batchNumber: parsed.batchNumber,
        });
        setNewMedName(parsed.medicineName);
      }
    } else {
      // EAN-13 or unknown — look up by barcode in DB
      const { data: med } = await supabase
        .from("medicines")
        .select("id, name, pharma_company, unit")
        .eq("barcode", rawCode)
        .single();

      if (med) {
        await addToDemand(med);
      } else {
        // Not found — ask worker to name it
        setUnknownBarcode({ rawCode, suggestedName: "" });
        setNewMedName("");
      }
    }
  }

  async function saveNewMedicine() {
    if (!unknownBarcode || !newMedName.trim()) return;

    const { data: med } = await supabase
      .from("medicines")
      .insert({
        name: newMedName.trim(),
        barcode: unknownBarcode.rawCode,
        unit: "box",
        threshold: 10,
      })
      .select()
      .single();

    if (!med) return;

    await supabase.from("inventory").insert({ medicine_id: med.id, quantity_current: 0 });
    await supabase.from("demand_list").insert({ medicine_id: med.id, status: "pending" });

    setUnknownBarcode(null);
    setNewMedName("");
    showFeedback(`✓ ${newMedName.trim()} registered and added to demand`, true);
    fetchDemand();
  }

  async function markOrdered(id: string) {
    await supabase.from("demand_list").update({ status: "ordered" }).eq("id", id);
    fetchDemand();
  }

  async function removeFromDemand(id: string) {
    await supabase.from("demand_list").delete().eq("id", id);
    fetchDemand();
  }

  async function markAllOrdered() {
    const ids = demandList.map((d) => d.id);
    if (ids.length === 0) return;
    await supabase.from("demand_list").update({ status: "ordered" }).in("id", ids);
    fetchDemand();
  }

  return (
    <div className="p-4 space-y-4">
      {/* Search + Scan */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search medicine to add..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {searchResults.map((med) => (
                <button key={med.id} onClick={() => addToDemand(med)}
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-gray-100 last:border-0">
                  <p className="text-sm font-medium text-gray-900">{med.name}</p>
                  <p className="text-xs text-gray-500">{med.pharma_company || "—"}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowScanner(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium">
          <ScanLine size={18} />
          Scan
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl border ${
          feedback.ok ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Unknown barcode form */}
      {unknownBarcode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800">
            {unknownBarcode.suggestedName ? "Confirm medicine name:" : "New barcode — enter medicine name:"}
          </p>
          {unknownBarcode.expiryDate && (
            <p className="text-xs text-amber-600">Expiry: {unknownBarcode.expiryDate} · Batch: {unknownBarcode.batchNumber}</p>
          )}
          <input
            placeholder="Medicine name"
            value={newMedName}
            onChange={(e) => setNewMedName(e.target.value)}
            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={saveNewMedicine}
              className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">
              Save & Add to Demand
            </button>
            <button onClick={() => setUnknownBarcode(null)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mark all ordered */}
      {demandList.length > 0 && (
        <button onClick={markAllOrdered}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl font-medium text-sm">
          <CheckCircle size={18} />
          Mark All as Ordered ({demandList.length} medicines)
        </button>
      )}

      {/* Demand List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : demandList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Demand list is empty</p>
          <p className="text-xs mt-1">Search or scan a barcode to flag low-stock medicine</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium px-1">
            Show this list to the rep — {demandList.length} medicines needed
          </p>
          {demandList.map((item) => (
            <div key={item.id}
              className="bg-white rounded-xl border border-orange-200 p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{item.medicines?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.medicines?.pharma_company || "—"}</p>
              </div>
              <div className="flex gap-2 ml-2">
                <button onClick={() => markOrdered(item.id)}
                  className="p-2 bg-green-100 text-green-600 rounded-lg" title="Mark as ordered">
                  <CheckCircle size={16} />
                </button>
                <button onClick={() => removeFromDemand(item.id)}
                  className="p-2 bg-red-100 text-red-500 rounded-lg" title="Remove">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
