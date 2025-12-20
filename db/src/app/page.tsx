'use client'

import { useState, useEffect } from 'react'
import ModuleForm from '@/components/ModuleForm'
import ModuleList from '@/components/ModuleList'
import SearchAndFilter from '@/components/SearchAndFilter'

export type Module = {
  id: string
  name: string
  description: string | null
  numberOfEndplates: number
  numberOfMainlines: 'SINGLE' | 'DOUBLE'
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'DEVELOPMENT'
  category: string
  owner: string | null
  location: string | null
  documentation: string | null
  dependencies: string[]
  createdAt: string
  updatedAt: string
}

export type ModuleFilters = {
  search: string
  status: string
  category: string
  page: number
  limit: number
}

export default function Home() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [filters, setFilters] = useState<ModuleFilters>({
    search: '',
    status: '',
    category: '',
    page: 1,
    limit: 10,
  })

  const fetchModules = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
      })

      const response = await fetch(`/api/modules?${params}`)
      const data = await response.json()

      if (response.ok) {
        setModules(data.modules)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching modules:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModules()
  }, [filters])

  const handleCreateModule = () => {
    setEditingModule(null)
    setShowForm(true)
  }

  const handleEditModule = (module: Module) => {
    setEditingModule(module)
    setShowForm(true)
  }

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return

    try {
      const response = await fetch(`/api/modules/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchModules()
      }
    } catch (error) {
      console.error('Error deleting module:', error)
    }
  }

  const handleFormSubmit = () => {
    setShowForm(false)
    setEditingModule(null)
    fetchModules()
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingModule(null)
  }

  const handleFilterChange = (newFilters: Partial<ModuleFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1, // Reset to page 1 when other filters change
    }))
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Module Records Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create, manage, and track your module records with version control and metadata.
        </p>
      </div>

      {showForm ? (
        <ModuleForm
          module={editingModule}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      ) : (
        <>
          <SearchAndFilter
            filters={filters}
            onFilterChange={handleFilterChange}
            onCreateNew={handleCreateModule}
          />

          <ModuleList
            modules={modules}
            loading={loading}
            pagination={pagination}
            onEdit={handleEditModule}
            onDelete={handleDeleteModule}
            onPageChange={(page: number) => handleFilterChange({ page })}
          />
        </>
      )}
    </div>
  )
}
