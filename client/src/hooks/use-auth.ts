import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error } = useQuery<any>({
    queryKey: ["/api/me"],
    retry: false,
  });

  const isAuthenticated = !!user && !error;

  const refetchUser = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/me"] });
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    refetchUser,
  };
}