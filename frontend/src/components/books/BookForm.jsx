import React, { useEffect, useState } from 'react';
import { bookService } from '../../services/bookServices';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const GENRES = [
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Horror',
    'Mystery',
    'Romance',
    'Science Fiction',
    'Slice of Life',
    'Sports',
    'Supernatural',
    'Thriller',
    'Other',
];

const EMPTY_FORM = {
    title: '',
    author: '',
    genre: GENRES[0],
    status: 'want_to_read',
    rating: '',
    volume: '',
    pages_total: '',
    pages_read: 0,
    notes: '',
    cover_url: '',
};

const BookForm = ({ isOpen, onClose, bookToEdit, onSaveSuccess }) => {
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (bookToEdit) {
            setFormData({
                title: bookToEdit.title || '',
                author: bookToEdit.author || '',
                genre: bookToEdit.genre || GENRES[0],
                status: bookToEdit.status || 'want_to_read',
                rating: bookToEdit.rating || '',
                volume: bookToEdit.volume || '',
                pages_total: bookToEdit.pages_total || '',
                pages_read: bookToEdit.pages_read || 0,
                notes: bookToEdit.notes || '',
                cover_url: bookToEdit.cover_url || '',
            });
        } else {
            setFormData(EMPTY_FORM);
        }

        setError(null);
    }, [bookToEdit, isOpen]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        const numericFields = [
            'rating',
            'volume',
            'pages_total',
            'pages_read',
        ];

        const parsedValue = numericFields.includes(name)
            ? value === ''
                ? ''
                : parseInt(value, 10)
            : value;

        setFormData((previous) => ({
            ...previous,
            [name]: parsedValue,
        }));
    };

    const handleSelectChange = (name, value) => {
        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const payload = { ...formData };

        if (payload.rating === '') payload.rating = null;
        if (payload.volume === '') payload.volume = null;
        if (payload.pages_total === '') payload.pages_total = null;
        if (payload.pages_read === '') payload.pages_read = 0;
        if (payload.cover_url === '') payload.cover_url = null;

        try {
            if (bookToEdit) {
                await bookService.updateBook(bookToEdit.id, payload);
            } else {
                await bookService.createBook(payload);
            }

            onSaveSuccess();
            onClose();
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {bookToEdit ? 'Edit Book' : 'Add New Book'}
                    </DialogTitle>
                    <DialogDescription>
                        Update the book information and reading progress.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div
                        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="book-form-title">Title</Label>
                        <Input
                            id="book-form-title"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="book-form-author">Author</Label>
                        <Input
                            id="book-form-author"
                            name="author"
                            value={formData.author}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="book-form-cover">Cover image URL</Label>
                        <Input
                            id="book-form-cover"
                            name="cover_url"
                            value={formData.cover_url}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Genre</Label>
                            <Select
                                value={formData.genre}
                                onValueChange={(value) =>
                                    handleSelectChange('genre', value)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select genre" />
                                </SelectTrigger>
                                <SelectContent>
                                    {GENRES.map((genre) => (
                                        <SelectItem key={genre} value={genre}>
                                            {genre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) =>
                                    handleSelectChange('status', value)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="want_to_read">
                                        Want to Read
                                    </SelectItem>
                                    <SelectItem value="reading">
                                        Reading
                                    </SelectItem>
                                    <SelectItem value="completed">
                                        Completed
                                    </SelectItem>
                                    <SelectItem value="dropped">
                                        Dropped
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="book-form-volume">Volume</Label>
                            <Input
                                id="book-form-volume"
                                name="volume"
                                type="number"
                                min="1"
                                value={formData.volume}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="book-form-rating">Rating</Label>
                            <Input
                                id="book-form-rating"
                                name="rating"
                                type="number"
                                min="1"
                                max="5"
                                value={formData.rating}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="book-form-pages-read">
                                Pages read
                            </Label>
                            <Input
                                id="book-form-pages-read"
                                name="pages_read"
                                type="number"
                                min="0"
                                value={formData.pages_read}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="book-form-pages-total">
                                Total pages
                            </Label>
                            <Input
                                id="book-form-pages-total"
                                name="pages_total"
                                type="number"
                                min="0"
                                value={formData.pages_total}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="book-form-notes">Notes</Label>
                        <Textarea
                            id="book-form-notes"
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default BookForm;