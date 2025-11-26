'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Checkbox } from '../ui/checkbox'
import { ScrollArea } from '../ui/scroll-area'
import CategoryBadge from './category-badge'
import { Tag, Check } from 'lucide-react'

export default function BulkCategoryDialog({ apps, onCategorize }) {
  const [selectedApps, setSelectedApps] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [open, setOpen] = useState(false)

  const categories = [
    'Browsing',
    'Code',
    'Communication',
    'Documenting',
    'Entertainment',
    'Learning',
    'Messaging',
    'Miscellaneous',
    'Personal',
    'Productivity',
    'Utility'
  ]

  const handleSelectAll = () => {
    if (selectedApps.length === apps.length) {
      setSelectedApps([])
    } else {
      setSelectedApps(apps.map((app) => app.id))
    }
  }

  const handleToggleApp = (appId) => {
    if (selectedApps.includes(appId)) {
      setSelectedApps(selectedApps.filter((id) => id !== appId))
    } else {
      setSelectedApps([...selectedApps, appId])
    }
  }

  const handleCategorize = () => {
    if (selectedApps.length > 0 && selectedCategory) {
      onCategorize(selectedApps, selectedCategory)
      setOpen(false)
      setSelectedApps([])
      setSelectedCategory('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">
          <Tag className="mr-2 h-4 w-4" />
          Bulk Categorize
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-50">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-slate-50">Bulk Categorize Applications</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-slate-400">
            Select multiple applications and assign them to a category.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              {selectedApps.length === apps.length ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {selectedApps.length} of {apps.length} selected
            </span>
          </div>

          <ScrollArea className="h-[200px] border border-gray-300 dark:border-slate-700 rounded-md p-2">
            <div className="space-y-2">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`app-${app.id}`}
                      checked={selectedApps.includes(app.id)}
                      onCheckedChange={() => handleToggleApp(app.id)}
                      className="border-gray-300 dark:border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                    />
                    <label
                      htmlFor={`app-${app.id}`}
                      className="text-sm font-medium leading-none cursor-pointer flex items-center text-gray-900 dark:text-slate-200"
                    >
                      {app.name}
                    </label>
                  </div>
                  <CategoryBadge category={app.category} />
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Target Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-200">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-50">
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    <div className="flex items-center">
                      <CategoryBadge category={category} />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCategorize}
            disabled={selectedApps.length === 0 || !selectedCategory}
            className="bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="mr-2 h-4 w-4" />
            Apply Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
