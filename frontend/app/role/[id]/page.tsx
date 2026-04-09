import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

/** Legacy path — all role views live under /boss/role/:id */
export default async function LegacyRoleRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/boss/role/${id}`)
}
