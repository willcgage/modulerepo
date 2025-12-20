'use client'

import { useState, useEffect } from 'react'
import { Module } from '@/app/page'

type ModuleFormProps = {
  module: Module | null
  onSubmit: () => void
  onCancel: () => void
}

export default function ModuleForm({ module, onSubmit, onCancel }: ModuleFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    numberOfEndplates: 1,
    numberOfMainlines: 'SINGLE' as 'SINGLE' | 'DOUBLE',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'DEVELOPMENT',
    category: '',
    owner: '',
    location: '',
    documentation: '',
    dependencies: [] as string[],
  })
  const [dependencyInput, setDependencyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (module) {
      setFormData({
        name: module.name,
        description: module.description || '',
        numberOfEndplates: module.numberOfEndplates,
        numberOfMainlines: module.numberOfMainlines,
        status: module.status,
        category: module.category,
        owner: module.owner || '',
        location: module.location || '',
        documentation: module.documentation || '',
        dependencies: module.dependencies || [],
      })
    }
  }, [module])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        ...formData,
        dependencies: formData.dependencies,
      }

      const response = await fetch(
        module ? `/api/modules/${module.id}` : '/api/modules',
        {
          method: module ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save module')
      }

      onSubmit()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfEndplates' ? parseInt(value) || 1 : value,
    }))
  }

  const addDependency = () => {
    if (dependencyInput.trim() && !formData.dependencies.includes(dependencyInput.trim())) {
      setFormData(prev => ({
        ...prev,
        dependencies: [...prev.dependencies, dependencyInput.trim()],
      }))
      setDependencyInput('')
    }
  }

  const removeDependency = (index: number) => {
    setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {module ? 'Edit Module' : 'Create New Module'}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Number of Endplates *
            </label>
            <input
              type="number"
              name="numberOfEndplates"
              value={formData.numberOfEndplates}
              onChange={handleInputChange}
              required
              min="1"
              placeholder="1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Number of Mainlines *
            </label>
            <select
              name="numberOfMainlines"
              value={formData.numberOfMainlines}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="SINGLE">Single</option>
              <option value="DOUBLE">Double</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category *
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              required
              placeholder="e.g., Frontend, Backend, API"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DEPRECATED">Deprecated</option>
              <option value="DEVELOPMENT">Development</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Owner
            </label>
            <input
              type="text"
              name="owner"
              value={formData.owner}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., City, State/Province, Country"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Documentation URL
          </label>
          <input
            type="url"
            name="documentation"
            value={formData.documentation}
            onChange={handleInputChange}
            placeholder="https://docs.example.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Dependencies
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={dependencyInput}
              onChange={(e) => setDependencyInput(e.target.value)}
              placeholder="Add dependency"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDependency())}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="button"
              onClick={addDependency}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.dependencies.map((dep, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm"
              >
                {dep}
                <button
                  type="button"
                  onClick={() => removeDependency(index)}
                  className="text-gray-500 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : module ? 'Update Module' : 'Create Module'}
          </button>
        </div>
      </form>
    </div>
  )
}
