// components/search-filters.jsx
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SlidersHorizontal } from "lucide-react"

const PRICING_OPTIONS = ['free', 'freemium', 'paid']
const TYPE_OPTIONS = ['tool', 'platform', 'directory', 'newsletter']

export function SearchFilters({ filters, onChange, onApply }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleFilterChange = (key, value) => {
    let newFilters;
    if (value === "all") {
      newFilters = { ...filters }
      delete newFilters[key]
    } else {
      newFilters = { ...filters, [key]: value }
    }
    onChange(newFilters)
    onApply(newFilters)
  }

  const handleReset = () => {
    onChange({})
    onApply({})
    setIsOpen(false)
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Search Filters</SheetTitle>
          <SheetDescription>
            Refine your search results
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pricing</label>
            <Select
              value={filters.pricing || null}
              onValueChange={(value) => handleFilterChange('pricing', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All pricing types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pricing types</SelectItem>
                {PRICING_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tool Type</label>
            <Select
              value={filters.type || null}
              onValueChange={(value) => handleFilterChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All tool types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tool types</SelectItem>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={handleReset}
          >
            Reset Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}