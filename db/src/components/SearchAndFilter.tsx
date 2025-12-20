'use client'

import { ModuleFilters } from '@/app/page'

type SearchAndFilterProps = {
  filters: ModuleFilters
  onFilterChange: (filters: Partial<ModuleFilters>) => void
  onCreateNew: () => void
}

export default function SearchAndFilter({ filters, onFilterChange, onCreateNew }: SearchAndFilterProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ search: e.target.value, page: 1 })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ status: e.target.value, page: 1 })
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ category: e.target.value, page: 1 })
  }

  const clearFilters = () => {
    onFilterChange({ search: '', status: '', category: '', page: 1 })
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          {/* Search Input */}
          <div className="flex-1 min-w-0">
            <label htmlFor="search" className="sr-only">
              Search modules
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="search"
                type="text"
                placeholder="Search by name, description, or owner..."
                value={filters.search}
                onChange={handleSearchChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-white sm:text-sm"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="min-w-0">
            <label htmlFor="status" className="sr-only">
              Filter by status
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={handleStatusChange}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DEPRECATED">Deprecated</option>
              <option value="DEVELOPMENT">Development</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="min-w-0">
            <label htmlFor="category" className="sr-only">
              Filter by category
            </label>
            <input
              id="category"
              type="text"
              placeholder="Filter by category..."
              value={filters.category}
              onChange={handleCategoryChange}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-white sm:text-sm"
            />
          </div>

          {/* Clear Filters Button */}
          {(filters.search || filters.status || filters.category) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Create New Button */}
        <div className="flex-shrink-0">
          <button
            onClick={onCreateNew}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 whitespace-nowrap"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Module
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.search || filters.status || filters.category) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
          {filters.search && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              Search: &quot;{filters.search}&quot;
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              Status: {filters.status}
            </span>
          )}
          {filters.category && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              Category: &quot;{filters.category}&quot;
            </span>
          )}
        </div>
      )}
    </div>
  )
}
