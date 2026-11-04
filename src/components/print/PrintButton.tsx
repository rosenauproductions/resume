"use client";

export function PrintButton() {
  return (
    <button type="button" className="primary" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
