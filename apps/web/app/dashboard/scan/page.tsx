import { BarcodeScanner } from '@/components/scan/BarcodeScanner';

export default function ScanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leitor de codigo</h1>
        <p className="text-sm text-slate-500">
          Aponte a camera para o codigo de barras ou QR code do produto para abrir o cadastro rapidamente.
        </p>
      </div>
      <BarcodeScanner />
    </div>
  );
}
