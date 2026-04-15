import { useRouteError, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Home } from 'iconsax-reactjs';

export default function ErrorPage() {
  const error = useRouteError() as { statusText?: string; message?: string };

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <h1 className="mb-2">Something went wrong</h1>
      <p className="text-btn text-[var(--muted-foreground)] mb-8">
        {error?.statusText || error?.message || 'An unexpected error occurred'}
      </p>
      <Link to="/">
        <Button variant="primary" icon={<Home size={14} />}>Back to Home</Button>
      </Link>
    </div>
  );
}
