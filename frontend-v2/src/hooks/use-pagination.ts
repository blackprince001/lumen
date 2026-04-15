interface UsePaginationProps {
  currentPage: number;
  totalPages: number;
  itemsToShow?: number;
}

interface UsePaginationReturn {
  pages: number[];
  showLeftEllipsis: boolean;
  showRightEllipsis: boolean;
}

export function usePagination({
  currentPage,
  totalPages,
  itemsToShow = 5,
}: UsePaginationProps): UsePaginationReturn {
  if (totalPages <= itemsToShow) {
    return {
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
      showLeftEllipsis: false,
      showRightEllipsis: false,
    };
  }

  const half = Math.floor(itemsToShow / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, currentPage + half);

  if (currentPage <= half + 1) { start = 1; end = itemsToShow; }
  if (currentPage >= totalPages - half) { start = totalPages - itemsToShow + 1; end = totalPages; }

  return {
    pages: Array.from({ length: end - start + 1 }, (_, i) => start + i),
    showLeftEllipsis: start > 1,
    showRightEllipsis: end < totalPages,
  };
}
