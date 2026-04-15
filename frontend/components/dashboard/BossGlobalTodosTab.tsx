'use client'

import { useCallback } from 'react'
import { TaskList } from '@/components/app/TaskList'
import { useAppState } from '@/context/AppStateContext'
import type { TaskStatus } from '@/lib/types'

export function BossGlobalTodosTab() {
  const { tasks, updateTask, deleteTask, addTask, getRoleById } = useAppState()

  const getRoleLabel = useCallback(
    (t: { roleId: string }) => getRoleById(t.roleId)?.name?.trim() || 'Role',
    [getRoleById]
  )

  const roleHrefForTask = useCallback((t: { roleId: string }) => `/boss/role/${t.roleId}`, [])

  const onAddSubtask = useCallback(
    (parentId: string, title: string) => {
      const parent = tasks.find((x) => x.id === parentId)
      if (!parent) return
      addTask(parent.roleId, title, { parentTaskId: parentId })
    },
    [tasks, addTask]
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Every open task across your roles. Role labels link to that role&apos;s workspace.
      </p>
      <TaskList
        tasks={tasks}
        getRoleLabel={getRoleLabel}
        roleHrefForTask={roleHrefForTask}
        onChangeStatus={(id, status: TaskStatus) => updateTask(id, { status })}
        onEditTitle={(id, title) => updateTask(id, { title })}
        onDelete={deleteTask}
        onAddSubtask={onAddSubtask}
      />
    </div>
  )
}
