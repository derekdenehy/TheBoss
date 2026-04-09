import { RoleWorkspace } from '@/components/app/RoleWorkspace'

type Props = { params: Promise<{ id: string }> }

export default async function BossRolePage({ params }: Props) {
  const { id } = await params
  return <RoleWorkspace roleId={id} />
}
