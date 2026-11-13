import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarcodeScanner } from '@/components/scan/BarcodeScanner';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Leitor de código' };

export default async function ScanPage() {
  const user = await getCurrentUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leitor de código"
        description="Aponte a câmera para o código de barras ou QR code do produto para abrir o cadastro. Para vender, use o PDV: um leitor USB funciona direto no campo de busca."
      />
      <BarcodeScanner canCreate={user?.role === 'ADMIN'} />
    </div>
  );
}
