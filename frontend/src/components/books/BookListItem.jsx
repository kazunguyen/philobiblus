import React from 'react';
import { BookOpen, Eye, Pencil, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getBookStatusLabel } from '@/lib/bookStatus';
import { getPublicationStatusLabel } from '@/lib/publicationStatus';

const BookListItem = ({ book, onDelete, onEdit, isReadOnly = false }) => {
    const navigate = useNavigate();
    const hasPagesRead = book.pages_read >= 0;
    const hasPagesTotal = book.pages_total >= 0;
    const progress = book.pages_total > 0 && hasPagesRead
        ? Math.min((book.pages_read / book.pages_total) * 100, 100)
        : 0;
    const tags = Array.isArray(book.tags) && book.tags.length > 0
        ? book.tags
        : book.genre
            ? [book.genre]
            : [];

    const progressColor = book.status === 'dropped'
        ? 'bg-destructive'
        : progress >= 100
            ? 'bg-emerald-500'
            : progress > 0
                ? 'bg-blue-500'
                : 'bg-muted-foreground';

    return (
        <article className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {book.cover_url ? (
                    <img
                        src={book.cover_url}
                        alt={`${book.title} cover`}
                        className="h-full w-full object-contain"
                    />
                ) : (
                    <BookOpen className="size-6 text-muted-foreground" />
                )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
                <div>
                    <h3 className="truncate font-semibold">{book.title}</h3>
                    <p className="truncate text-sm text-muted-foreground">{book.author}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{getBookStatusLabel(book.status)}</Badge>
                    <Badge variant="outline">
                        {getPublicationStatusLabel(book.publication_status)}
                    </Badge>
                    {tags.map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                </div>

                {book.pages_total > 0 && hasPagesRead && (
                    <div className="max-w-md space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{book.pages_read} / {book.pages_total} pages</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} indicatorClassName={progressColor} />
                    </div>
                )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
                {!isReadOnly ? (
                    <>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/books/${book.id}`)}>
                            <Eye />
                            View
                        </Button>
                        <Button variant="secondary" size="sm" onClick={onEdit}>
                            <Pencil />
                            Edit
                        </Button>
                        <Button variant="destructive" size="icon-sm" onClick={onDelete} aria-label="Delete book">
                            <Trash2 />
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/public/books/${book.id}`)}>
                            <Eye />
                            View details
                        </Button>
                        {book.owner?.username && (
                            <Button variant="secondary" size="sm" onClick={() => navigate(`/users/${book.owner.username}`)}>
                                <UserRound />
                                View profile
                            </Button>
                        )}
                    </>
                )}
            </div>
        </article>
    );
};

export default BookListItem;
