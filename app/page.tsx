"use client";

import { useState } from "react";
import { Package, AlertTriangle, FileText } from "lucide-react";
import InventoryTab from "@/components/InventoryTab";
import DemandTab from "@/components/DemandTab";
import BillTab from "@/components/BillTab";

const tabs = [
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "demand", label: "Demand", icon: AlertTriangle },
  { id: "bill", label: "Bill Upload", icon: FileText },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("inventory");

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-4 shadow">
        <h1 className="text-xl font-bold">MedStore</h1>
        <p className="text-green-100 text-sm">Medical Store Manager</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-20">
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "demand" && <DemandTab />}
        {activeTab === "bill" && <BillTab />}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                isActive
                  ? "text-green-600 border-t-2 border-green-600"
                  : "text-gray-500"
              }`}
            >
              <Icon size={22} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
