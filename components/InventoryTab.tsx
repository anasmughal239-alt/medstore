"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Search, AlertCircle, Package } from "lucide-react";

type Medicine = {
  id: string;
  name: string;
  barcode: string | null;
  pharma_company: string | null;
  unit: string;
  threshold: number;
};

type InventoryRow = {
  id: string;
  medicine_id: string;
  quantity_current: number;
  expiry_date: string | null;
  batch_number: string | null;
  medicines: Medicine;
};

export default function InventoryTab() {
  const supabase = createClient();
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: "",
    pharma_company: "",
    barcode: "",
    unit: "box",
    threshold: 10,
    quantity_current: 0,
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    setLoading(true);
    const { data } = await supabase
      .from("inventory")
      .select(`*, medicines(*)`)
      .order("last_updated", { ascending: false });
    if (data) setInventory(data as InventoryRow[]);
    setLoading(false);
  }

  async function addMedicine() {
    if (!newMedicine.name.trim()) return;

    const { data: med } = await supabase
      .from("medicines")
      .insert({
        name: newMedicine.name,
        pharma_company: newMedicine.pharma_company || null,
        barcode: newMedicine.barcode || null,
        unit: newMedicine.unit,
        threshold: newMedicine.threshold,
      })
      .select()
      .single();

    if (med) {
      await supabase.from("inventory").insert({
        medicine_id: med.id,
        quantity_current: newMedicine.quantity_current,
      });
    }

    setNewMedicine({ name: "", pharma_company: "", barcode: "", unit: "box", threshold: 10, quantity_current: 0 });
    setShowAddForm(false);
    fetchInventory();
  }

  const filtered = inventory.filter((row) =>
    row.medicines?.name?.toLowerCase().includes(search.toLowerCase()) ||
    row.medicines?.pharma_company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search medicines..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Add Button */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm"
      >
        <Plus size={18} />
        Add Medicine
      </button>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">New Medicine</h3>
          <input
            placeholder="Medicine name *"
            value={newMedicine.name}
            onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            placeholder="Company (e.g. GSK, Searle)"
            value={newMedicine.pharma_company}
            onChange={(e) => setNewMedicine({ ...newMedicine, pharma_company: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            placeholder="Barcode (optional)"
            value={newMedicine.barcode}
            onChange={(e) => setNewMedicine({ ...newMedicine, barcode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Current qty"
              value={newMedicine.quantity_current}
              onChange={(e) => setNewMedicine({ ...newMedicine, quantity_current: parseInt(e.target.value) || 0 })}
              className="w-1/2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="number"
              placeholder="Min threshold"
              value={newMedicine.threshold}
              onChange={(e) => setNewMedicine({ ...newMedicine, threshold: parseInt(e.target.value) || 10 })}
              className="w-1/2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addMedicine}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inventory List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Package size={40} className="mx-auto mb-2 opacity-30" />
          <p>No medicines found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const isLow = row.quantity_current <= row.medicines?.threshold;
            return (
              <div
                key={row.id}
                className={`bg-white rounded-xl border p-4 flex items-center justify-between ${
                  isLow ? "border-red-200 bg-red-50" : "border-gray-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isLow && <AlertCircle size={14} className="text-red-500 flex-shrink-0" />}
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {row.medicines?.name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {row.medicines?.pharma_company || "—"}
                  </p>
                  {row.expiry_date && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Expiry: {row.expiry_date}
                    </p>
                  )}
                </div>
                <div className="text-right ml-3">
                  <p className={`text-xl font-bold ${isLow ? "text-red-600" : "text-green-600"}`}>
                    {row.quantity_current}
                  </p>
                  <p className="text-xs text-gray-400">{row.medicines?.unit}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
