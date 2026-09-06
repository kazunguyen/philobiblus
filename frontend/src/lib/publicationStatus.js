export const PUBLICATION_STATUS_OPTIONS = [
    { value: 'ongoing', label: 'Currently publishing' },
    { value: 'completed', label: 'Publishing completed' },
];

export const getPublicationStatusLabel = (value) =>
    PUBLICATION_STATUS_OPTIONS.find((option) => option.value === value)?.label || value;
