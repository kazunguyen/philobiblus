export const BOOK_STATUS_LABELS = {
    want_to_read: 'Want to Read',
    reading: 'Reading',
    completed: 'Completed',
    dropped: 'Dropped',
};

/** Return a readable label for a book status value. */
export const getBookStatusLabel = (status) =>
    BOOK_STATUS_LABELS[status] || status?.replace(/_/g, ' ') || 'Unknown';
