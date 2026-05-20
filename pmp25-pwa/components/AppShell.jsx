export default function AppShell({ children }) {
  return (
    <main className="min-h-screen bg-slate-200">
      <div className="mx-auto min-h-screen max-w-md overflow-hidden bg-[#f0f8ff] shadow-2xl">
        {children}
      </div>
    </main>
  );
}