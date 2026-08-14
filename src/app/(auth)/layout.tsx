export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      {children}
    </div>
  )
}
