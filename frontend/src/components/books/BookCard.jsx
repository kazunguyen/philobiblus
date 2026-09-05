import React from 'react';
import { BookOpen, Eye, Pencil, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getBookStatusLabel } from '@/lib/bookStatus';

const BookCard = ({ book, onDelete, onEdit, isReadOnly = false }) => {
    const navigate = useNavigate();

    const progress = book.pages_total
        ? Math.min((book.pages_read / book.pages_total) * 100, 100)
        : 0;

    const bookTags =
        Array.isArray(book.tags) && book.tags.length > 0
            ? book.tags
            : book.genre
                ? [book.genre]
                : [];

    const statusLabel = getBookStatusLabel(book.status);

    return (
        <Card className="flex h-full w-[280px] flex-col overflow-hidden">
            <div className="flex h-56 w-full items-center justify-center border-b bg-muted/40">
                {book.cover_url ? (
                    <img
                        src={book.cover_url}
                        alt={`${book.title} cover`}
                        className="h-full w-full object-contain p-3"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <BookOpen className="size-10" />
                        <span className="text-sm font-medium">No cover</span>
                    </div>
                )}
            </div>

            <CardHeader className="space-y-2">
                <CardTitle className="line-clamp-2 min-h-12 text-base">
                    {book.title}
                </CardTitle>

                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{statusLabel}</Badge>
                    {bookTags.map((tag) => (
                        <Badge key={tag} variant="outline">
                            {tag}
                        </Badge>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3">
                <div className="space-y-1 text-sm">
                    <p className="line-clamp-1 text-muted-foreground">
                        <span className="font-medium text-foreground">Author:</span> {book.author}
                    </p>

                    {book.volume && (
                        <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Volume:</span> {book.volume}
                        </p>
                    )}

                    {book.rating && (
                        <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Rating:</span>{' '}
                            {'★'.repeat(book.rating)}
                        </p>
                    )}
                </div>

                <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} />
                    <p className="text-xs text-muted-foreground">
                        {book.pages_read || 0} / {book.pages_total || '?'} pages
                    </p>
                </div>
            </CardContent>

            <CardFooter className="flex-wrap gap-2">
                {!isReadOnly ? (
                    <>
                        <Button
                            className="flex-1"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/books/${book.id}`)}
                        >
                            <Eye />
                            View
                        </Button>
                        <Button className="flex-1" variant="secondary" size="sm" onClick={onEdit}>
                            <Pencil />
                            Edit
                        </Button>
                        <Button variant="destructive" size="icon-sm" onClick={onDelete}>
                            <Trash2 />
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            className="flex-1"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/public/books/${book.id}`)}
                        >
                            <Eye />
                            View details
                        </Button>
                        {book.owner?.username && (
                            <Button
                                className="flex-1"
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/users/${book.owner.username}`)}
                            >
                                <UserRound />
                                View profile
                            </Button>
                        )}
                    </>
                )}
            </CardFooter>
        </Card>
    );
};

export default BookCard;
