import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { bookService } from '../services/bookServices';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import StarRating from '../components/ui/StarRating';
import TagSelector, {
    TAG_OPTIONS,
} from '../components/ui/TagSelector';
import { getBookStatusLabel } from '@/lib/bookStatus';
import {
    BOOK_VISIBILITY_OPTIONS,
    getBookVisibilityLabel,
} from '@/lib/bookVisibility';
import {
    PUBLICATION_STATUS_OPTIONS,
    getPublicationStatusLabel,
} from '@/lib/publicationStatus';

const BookEditPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
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
        date_started: '',
        notes: '',
        cover_url: '',
        visibility: 'public',
        publication_status: 'ongoing',
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBook = async () => {
            try {
                setIsLoading(true);
                const book = await bookService.getBookById(id);

                const existingTags =
                    Array.isArray(book.tags) && book.tags.length > 0
                        ? book.tags
                        : book.genre
                            ? [book.genre]
                            : [TAG_OPTIONS[0]];

                setFormData({
                    title: book.title || '',
                    author: book.author || '',
                    genre: existingTags[0],
                    tags: existingTags,
                    status: book.status || 'want_to_read',
                    rating: book.rating || '',
                    volume: book.volume >= 0 ? book.volume : '',
                    pages_total: book.pages_total >= 0 ? book.pages_total : '',
                    pages_read: book.pages_read >= 0 ? book.pages_read : '',
                    date_started: book.date_started || '',
                    notes: book.notes || '',
                    cover_url: book.cover_url || '',
                    visibility: book.visibility || 'public',
                    publication_status: book.publication_status || 'ongoing',
                    chapters_read: book.chapters_read >= 0 ? book.chapters_read : '',
                });
            } catch (fetchError) {
                setError(fetchError.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBook();
    }, [id]);

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
        setIsSaving(true);
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
            await bookService.updateBook(id, payload);
            navigate(`/books/${id}`);
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-muted/30">
                <p className="py-12 text-center text-sm text-muted-foreground">
                    Loading book data...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30">

            <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
                <Button
                    variant="ghost"
                    className="mb-4"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft />
                    Back
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Edit Book</CardTitle>
                    </CardHeader>

                    <CardContent>
                        {error && (
                            <div
                                className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="author">Author</Label>
                                <Input
                                    id="author"
                                    name="author"
                                    value={formData.author}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="cover_url">Cover image URL</Label>
                                <Input
                                    id="cover_url"
                                    name="cover_url"
                                    value={formData.cover_url}
                                    onChange={handleChange}
                                />
                            </div>

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
                                    <Label htmlFor="volume">Volume</Label>
                                    <Input
                                        id="volume"
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
                                    <Label htmlFor="pages_read">Pages read</Label>
                                    <Input
                                        id="pages_read"
                                        name="pages_read"
                                        type="number"
                                        min="0"
                                        value={formData.pages_read}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="pages_total">Total pages</Label>
                                    <Input
                                        id="pages_total"
                                        name="pages_total"
                                        type="number"
                                        min="0"
                                        value={formData.pages_total}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="chapters_read">Chapters read</Label>
                                    <Input
                                        id="chapters_read"
                                        name="chapters_read"
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={formData.chapters_read}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="date_started">Started reading</Label>
                                    <Input
                                        id="date_started"
                                        name="date_started"
                                        type="date"
                                        value={formData.date_started}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                />
                            </div>

                            <Button type="submit" disabled={isSaving}>
                                <Save />
                                {isSaving ? 'Saving...' : 'Update book'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default BookEditPage;
