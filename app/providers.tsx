'use client';

import { NhostClient, NhostProvider, useAccessToken } from '@nhost/react';
import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { ReactNode, useMemo } from 'react';

const nhost = new NhostClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
  region: process.env.NEXT_PUBLIC_NHOST_REGION || 'local',
});

function CustomApolloProvider({ children }: { children: ReactNode }) {
  const accessToken = useAccessToken();

  const apolloClient = useMemo(() => {
    const httpLink = createHttpLink({
      uri: nhost.graphql.httpUrl,
    });

    const wsLink = typeof window !== 'undefined'
      ? new GraphQLWsLink(
        createClient({
          url: nhost.graphql.wsUrl,
          connectionParams: () => {
            return {
              headers: {
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
            };
          },
        })
      )
      : null;

    const authLink = setContext((_, { headers }) => {
      return {
        headers: {
          ...headers,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        }
      }
    });

    const splitLink = typeof window !== 'undefined' && wsLink != null
      ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        authLink.concat(httpLink),
      )
      : authLink.concat(httpLink);

    return new ApolloClient({
      link: splitLink,
      cache: new InMemoryCache()
    });
  }, [accessToken]);

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      <CustomApolloProvider>
        {children}
      </CustomApolloProvider>
    </NhostProvider>
  );
}
