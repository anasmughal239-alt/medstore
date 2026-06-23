// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let started = false;

    async function startScanner() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped || !containerRef.current) return;

      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 300, height: 200 }, disableFlip: false },
          (decodedText) => {
            console.log("Barcode scanned:", decodedText);
            onScan(decodedText);
          },
          () => {} // ignore errors
        );
        started = true;
        console.log("Scanner started successfully");
      } catch (err: any) {
        console.log("Scanner error:", err.message);
        setError(err.message || "Camera not accessible. Allow camera permission and try again.");
      }
    }

    startScanner();

    return () => {
      stopped = true;
      const scanner = scannerRef.current;
      if (scanner && started) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-gray-800">Scan Barcode</p>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>
        {error ? (
          <div className="p-6 text-center text-sm text-red-500">{error}</div>
        ) : (
          <div>
            <div id="barcode-reader" ref={containerRef} className="w-full" />
            <p className="text-center text-xs text-gray-400 py-3">
              Point camera at the medicine barcode
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
