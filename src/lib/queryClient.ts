
import { QueryClient } from '@tanstack/react-query';

// Create a single instance of QueryClient that can be reused
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});
