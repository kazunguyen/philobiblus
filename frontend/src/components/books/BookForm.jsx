import React, { useEffect, useState } from 'react';
import { bookService } from '../../services/bookServices';
import CoverImageField from './CoverImageField';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
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
import StarRating from '../ui/StarRating';
import TagSelector, {
    TAG_OPTIONS,
} from '../ui/TagSelector';
import { getBookStatusLabel } from '@/lib/bookStatus';
import {
    BOOK_VISIBILITY_OPTIONS,
    getBookVisibilityLabel,
} from '@/lib/bookVisibility';
import {
    PUBLICATION_STATUS_OPTIONS,
    getPublicationStatusLabel,
} from '@/lib/publicationStatus';

const getToday = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
};

const EMPTY_FORM = {
    title: '',
    author: '',
    genre: TAG_OPTIONS[0],
    tags: [TAG_OPTIONS[0]],
    status: 'want_to_read',
    rating: '',
    volume: '',
    pages_total: '',
    pages_read: '',
    chapters_read: '',
    date_started: getToday(),
    notes: '',
    cover_url: '',
    visibility: 'public',
    publication_status: 'ongoing',
};

const BookForm = ({ isOpen, onClose, bookToEdit, onSaveSuccess }) => {
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [isLoading, setIsLoading] = useState(false);
    const [isCoverUploading, setIsCoverUploading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (bookToEdit) {
            const existingTags =
                Array.isArray(bookToEdit.tags) && bookToEdit.tags.length > 0
                    ? bookToEdit.tags
                    : bookToEdit.genre
                        ? [bookToEdit.genre]
                        : [TAG_OPTIONS[0]];
            setFormData({
                title: bookToEdit.title || '',
                author: bookToEdit.author || '',
                genre: existingTags[0],
                tags: existingTags,
                status: bookToEdit.status || 'want_to_read',
                rating: bookToEdit.rating || '',
                volume: bookToEdit.volume >= 0 ? bookToEdit.volume : '',
                pages_total: bookToEdit.pages_total >= 0 ? bookToEdit.pages_total : '',
                pages_read: bookToEdit.pages_read >= 0 ? bookToEdit.pages_read : '',
                date_started: bookToEdit.date_started || '',
                notes: bookToEdit.notes || '',
                cover_url: bookToEdit.cover_url || '',
                visibility: bookToEdit.visibility || 'public',
                publication_status: bookToEdit.publication_status || 'ongoing',
                chapters_read: bookToEdit.chapters_read >= 0 ? bookToEdit.chapters_read : '',
            });
        } else {
            setFormData(EMPTY_FORM);
        }

        setError(null);
    }, [bookToEdit, isOpen]);

    const handleTagsChange = (tags) => {
        setFormData((previous) => ({
            ...previous,
            tags,
            genre: tags[0] || TAG_OPTIONS[0],
        }));
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        const numericFields = [
            'rating',
            'volume',
            'pages_total',
            'pages_read',
            'chapters_read',
        ];

        const parsedValue = numericFields.includes(name)
            ? value === ''
                ? ''
                : name === 'chapters_read'
                    ? parseFloat(value)
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
        if (!formData.tags.length) {
            setError('Please select at least one tag.');
            return;
        }
        setIsLoading(true);
        setError(null);

        const payload = { ...formData };
        payload.genre = payload.tags[0];

        if (payload.rating === '') payload.rating = null;
        if (payload.volume === '') payload.volume = -1;
        if (payload.pages_total === '') payload.pages_total = -1;
        if (payload.pages_read === '') payload.pages_read = -1;
        if (payload.chapters_read === '') payload.chapters_read = -1;
        if (payload.date_started === '') payload.date_started = null;
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

                    <CoverImageField
                        id="book-form-cover"
                        value={formData.cover_url}
                        onUrlChange={(coverUrl) =>
                            setFormData((previous) => ({
                                ...previous,
                                cover_url: coverUrl,
                            }))
                        }
                        onError={setError}
                        onUploadingChange={setIsCoverUploading}
                    />

                    <div className="space-y-5">
                        <TagSelector
                            value={formData.tags}
                            onChange={handleTagsChange}
                        />

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) =>
                                    handleSelectChange('status', value)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue>
                                        {getBookStatusLabel(formData.status)}
                                    </SelectValue>
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

                        <div className="space-y-2">
                            <Label>Visibility</Label>
                            <Select
                                value={formData.visibility}
                                onValueChange={(value) =>
                                    handleSelectChange('visibility', value)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue>
                                        {getBookVisibilityLabel(formData.visibility)}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {BOOK_VISIBILITY_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Publication status</Label>
                            <Select
                                value={formData.publication_status}
                                onValueChange={(value) =>
                                    handleSelectChange('publication_status', value)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue>
                                        {getPublicationStatusLabel(formData.publication_status)}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {PUBLICATION_STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
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

                        <StarRating
                            value={formData.rating}
                            onChange={(rating) =>
                                setFormData((previous) => ({
                                    ...previous,
                                    rating,
                                }))
                            }
                        />
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

                        <div className="space-y-2">
                            <Label htmlFor="book-form-chapters-read">
                                Chapters read
                            </Label>
                            <Input
                                id="book-form-chapters-read"
                                name="chapters_read"
                                type="number"
                                min="0"
                                step="0.1"
                                value={formData.chapters_read}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="book-form-date-started">
                                Started reading
                            </Label>
                            <Input
                                id="book-form-date-started"
                                name="date_started"
                                type="date"
                                value={formData.date_started}
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
                        <Button type="submit" disabled={isLoading || isCoverUploading}>
                            {isLoading ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default BookForm;
