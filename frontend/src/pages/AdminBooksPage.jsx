import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Search, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminServices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const AdminBooksPage = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService.getBooks()
      .then(setBooks)
      .catch((loadError) => setError(loadError.message));
  }, []);

  const filteredBooks = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return books;
    return books.filter((book) => (
      [book.title, book.author, book.owner?.username, book.visibility]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    ));
  }, [books, query]);

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Book resources</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All public, restricted, private, and retained books are visible here.
            </p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search title, author, owner..." />
          </div>
        </div>

        {error && <p className="mb-6 text-sm text-destructive" role="alert">{error}</p>}

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Book</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Visibility</th>
                  <th className="px-4 py-3 font-medium">Readers</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{book.title}</p>
                      <p className="text-muted-foreground">{book.author}</p>
                    </td>
                    <td className="px-4 py-3">{book.owner?.username || 'Deleted account'}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{book.visibility}</Badge></td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1"><UsersRound className="size-4" />{book.active_reader_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/books/${book.id}`)}>
                        <Eye /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBooks.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No books found.</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminBooksPage;
