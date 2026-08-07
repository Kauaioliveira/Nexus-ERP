export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
        Em desenvolvimento
      </span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Nexus ERP</h1>
      <p className="max-w-md text-slate-600">
        Sistema de controle de estoque multiusuario: produtos, movimentacoes, alertas de
        estoque minimo, dashboards e emissao fiscal integrada.
      </p>
    </main>
  );
}
