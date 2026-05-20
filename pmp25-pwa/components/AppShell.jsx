export default function AppShell({ children }) {
  return (
    <main className="app-root">
      <div className="phone-frame min-h-screen overflow-hidden">
        {children}
      </div>
    </main>
  );
}
