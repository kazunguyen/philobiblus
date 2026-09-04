import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const BookAddPage = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
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
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (event) => {
        const { name, value } = event.target;
        const numericFields = ['rating', 'volume', 'pages_total', 'pages_read'];
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
            await bookService.createBook(payload);
            navigate('/books');
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-muted/30">

            <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
                <Button
                    variant="ghost"
                    className="mb-4"
                    onClick={() => navigate('/books')}
                >
                    <ArrowLeft />
                    Back to library
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Add New Book</CardTitle>
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
                                    placeholder="Book title"
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
                                    placeholder="Author name"
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
                                    placeholder="https://example.com/cover.jpg"
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
                                    <Label htmlFor="volume">Volume</Label>
                                    <Input
                                        id="volume"
                                        name="volume"
                                        type="number"
                                        min="1"
                                        value={formData.volume}
                                        onChange={handleChange}
                                        placeholder="Volume number"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="rating">Rating</Label>
                                    <Input
                                        id="rating"
                                        name="rating"
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={formData.rating}
                                        onChange={handleChange}
                                        placeholder="1 to 5"
                                    />
                                </div>
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
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    placeholder="Personal notes"
                                />
                            </div>

                            <Button type="submit" disabled={isLoading}>
                                <Save />
                                {isLoading ? 'Saving...' : 'Save book'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default BookAddPage;
