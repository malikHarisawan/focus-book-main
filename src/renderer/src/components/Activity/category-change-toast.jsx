'use client'

import { Check } from 'lucide-react'
import { useToast } from '../../hooks/use-toast'

export default function useCategoryChangeToast() {
  const { toast } = useToast()

  const showCategoryChangeToast = ({ appName, category }) => {
    toast({
      title: 'Category Updated',
      description: (
        <div className="flex items-center">
          <span>
            <strong>{appName}</strong> is now categorized as <strong>{category}</strong>
          </span>
          <Check className="ml-2 h-4 w-4 text-green-400" />
        </div>
      ),
      duration: 3000
    })
  }

  return { showCategoryChangeToast }
}
