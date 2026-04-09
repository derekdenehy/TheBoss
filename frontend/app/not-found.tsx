import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Page not found</h1>
      <Link href="/" className="text-sky-400 hover:underline">
        Back to Progress
      </Link>
    </main>
  )
}
