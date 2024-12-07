// components/pagination.jsx
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

export function CustomPagination({ 
  currentPage, 
  totalPages, 
  onPageChange 
}) {
  if (totalPages <= 1) return null;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  // Create array of page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      // Show first page, last page, and pages around current page
      if (
        i === 1 || 
        i === totalPages ||
        (i >= currentPage - 2 && i <= currentPage + 2)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        // Add ellipsis if there's a gap
        pages.push('...');
      }
    }
    return pages;
  };

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          />
        </PaginationItem>

        {getPageNumbers().map((page, index) => (
          <PaginationItem key={index}>
            {page === '...' ? (
              <Button
                variant="outline"
                size="icon"
                disabled
              >
                ...
              </Button>
            ) : (
              <Button
                variant={currentPage === page ? "default" : "outline"}
                size="icon"
                onClick={() => handlePageChange(page)}
              >
                {page}
              </Button>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}