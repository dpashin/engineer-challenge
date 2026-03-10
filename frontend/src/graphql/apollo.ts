import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client/core';
import { DefaultApolloClient } from '@vue/apollo-composable';
import { onError } from '@apollo/client/link/error';
import type { GraphQLRequest } from '@apollo/client/core';
import { Observable } from '@apollo/client/core';

let authStore: any = null;

// Function to set auth store (called after store creation)
export function setAuthStore(store: any) {
  authStore = store;
}

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
  credentials: 'include',
});

// Error handling link for token refresh
const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      // Check for token expiration errors
      if (
        err.extensions?.['code'] === 'UNAUTHENTICATED' ||
        err.message?.includes('token') ||
        err.message?.includes('Token')
      ) {
        // Attempt to refresh token
        return new Observable((observer) => {
          handleTokenRefresh(operation, forward, observer);
        });
      }
    }
  }
});

async function handleTokenRefresh(
  operation: GraphQLRequest,
  forward: any,
  observer: any,
) {
  if (!authStore || !authStore.tokens) {
    observer.error(new Error('No auth store or tokens available'));
    return;
  }

  const refreshToken = authStore.tokens.refreshToken;

  if (!refreshToken) {
    observer.error(new Error('No refresh token available'));
    authStore.logout();
    return;
  }

  try {
    // Call the refresh token mutation
    const { REFRESH_TOKEN } = await import('./queries');
    const response = await fetch(
      import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: REFRESH_TOKEN,
          variables: { refreshToken },
        }),
      },
    );

    const result = await response.json();

    if (result.data?.refreshToken?.success) {
      const { accessToken, refreshToken: newRefreshToken } = result.data.refreshToken;

      // Update tokens in store
      authStore.updateTokens(accessToken, newRefreshToken);

      // Retry the original operation with new token
      const newOperation = {
        ...operation,
        context: {
          ...operation.context,
          headers: {
            ...operation.context?.headers,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      };

      const subscriber = {
        next: (res: any) => observer.next(res),
        error: (err: any) => observer.error(err),
        complete: () => observer.complete(),
      };

      forward(newOperation).subscribe(subscriber);
    } else {
      // Refresh failed, logout user
      console.error('Token refresh failed:', result.data?.refreshToken?.error);
      authStore.logout();
      observer.error(new Error('Token refresh failed'));
    }
  } catch (error) {
    console.error('Error during token refresh:', error);
    authStore.logout();
    observer.error(error);
  }
}

const apolloClient = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'no-cache',
    },
    mutate: {
      fetchPolicy: 'no-cache',
    },
  },
});

export function setupApollo(app: any) {
  app.provide(DefaultApolloClient, apolloClient);
}

export { apolloClient };
