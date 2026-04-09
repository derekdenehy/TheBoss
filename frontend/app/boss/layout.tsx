import { BossLayoutClient } from '@/components/app/BossLayoutClient'

export default function BossLayout({ children }: { children: React.ReactNode }) {
  return <BossLayoutClient>{children}</BossLayoutClient>
}
