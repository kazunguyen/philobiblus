import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BookViewToggle = ({ view, onViewChange }) => (
    <div className="flex items-center rounded-lg border bg-background p-1" role="group" aria-label="Book display mode">
        <Button
            type="button"
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="Show books as cards"
            onClick={() => onViewChange('grid')}
        >
            <LayoutGrid />
        </Button>
        <Button
            type="button"
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="Show books as a list"
            onClick={() => onViewChange('list')}
        >
            <List />
        </Button>
    </div>
);

export default BookViewToggle;
