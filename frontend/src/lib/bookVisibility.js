export const BOOK_VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
  },
  {
    value: 'restricted',
    label: 'Restricted',
  },
  {
    value: 'private',
    label: 'Private',
  },
];

export const getBookVisibilityLabel = (value) =>
  BOOK_VISIBILITY_OPTIONS.find((option) => option.value === value)?.label || value;
