export const BOOK_VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    description: 'Visible on the public dashboard and your profile.',
  },
  {
    value: 'restricted',
    label: 'Restricted',
    description: 'Hidden from listings; accessible with a share link.',
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Only you can view this book.',
  },
];

export const getBookVisibilityLabel = (value) =>
  BOOK_VISIBILITY_OPTIONS.find((option) => option.value === value)?.label || value;
