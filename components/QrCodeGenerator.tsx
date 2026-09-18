'use client';

interface QrCodeGeneratorProps {
  qrImageUrl?: string | null;
  amount?: number;
  name?: string;
  note?: string;
}

export function QrCodeGenerator({ qrImageUrl, amount, name, note }: QrCodeGeneratorProps) {
  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow">
      {!qrImageUrl && (
        <p className="text-sm text-gray-600 text-center">
          Payment QR is not configured for this shop. Please contact admin.
        </p>
      )}
      {qrImageUrl && (
        <div className="text-center">
          <img src={qrImageUrl} alt="Payment QR" className="mx-auto border rounded" />
          <p className="text-sm text-gray-500 mt-2">Scan to pay ₹{amount ?? 299}</p>
        </div>
      )}
    </div>
  );
}
