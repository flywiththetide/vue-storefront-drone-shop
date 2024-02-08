import type { Module, Connector } from "../../types";

// === Interfaces ===
export type AnyFunction = (...args: any[]) => any;

export type EndpointsConstraint = {
  [key: string]: AnyFunction;
};

export type EnforceEndpointsConstraint<T extends EndpointsConstraint> = T;

export interface RequestConfig {
  _isRequestConfig: true;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
}

export interface HTTPClient {
  get: (url: string, config?: RequestConfig) => Promise<any>;
  post: (url: string, data: any, config?: RequestConfig) => Promise<any>;
}

export interface Options {
  apiUrl: string;
  ssrApiUrl?: string;
  httpClient?: HTTPClient;
  defaultRequestConfig?: RequestConfig;
}

export type Methods<Endpoints extends EndpointsConstraint> = {
  [Key in keyof Endpoints]: (
    ...params: [...Parameters<Endpoints[Key]>, requestConfig?: RequestConfig]
  ) => ReturnType<Endpoints[Key]>;
};

export interface MiddlewareModule<Endpoints extends EndpointsConstraint>
  extends Module {
  connector: Methods<Endpoints>;
}

// interface MethodsToEndpoints

// === Helpers ===

export const prepareRequestConfig = (
  requestConfig: Omit<RequestConfig, "_isRequestConfig">
): RequestConfig => {
  return {
    _isRequestConfig: true,
    ...requestConfig,
  };
};

// === HTTP Client abstraction ===

const getHttpClient = (options: Options): HTTPClient => {
  const getHeaders = (requestConfig?: RequestConfig) => {
    return {
      ...(options.defaultRequestConfig?.headers ?? {}),
      ...(requestConfig?.headers ?? {}),
    };
  };

  const getUrl = (path: string): string => {
    // Determine the base URL based on the environment
    const baseUrl =
      typeof window === "undefined"
        ? options.ssrApiUrl || options.apiUrl
        : options.apiUrl;

    // Ensure the base URL ends with a slash
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

    return `${normalizedBaseUrl}${path}`;
  };

  const defaultHttpClient: HTTPClient = {
    get: async (url, requestConfig?) => {
      const response = await fetch(url, {
        method: "GET",
        headers: requestConfig?.headers,
      });
      return response.json();
    },
    post: async (url, data, requestConfig) => {
      const response = await fetch(url, {
        method: "POST",
        headers: requestConfig?.headers,
        body: JSON.stringify(data),
      });
      return response.json();
    },
  };

  const httpClient: HTTPClient = options.httpClient || defaultHttpClient;

  return {
    get: (path, config) => {
      const headers = getHeaders(config);
      return httpClient.get(getUrl(path), prepareRequestConfig({ headers }));
    },
    post: (path, data, config) => {
      const headers = getHeaders(config);
      return httpClient.post(
        getUrl(path),
        data,
        prepareRequestConfig({ headers })
      );
    },
  };
};

// === Connector ===

const middlewareConnector = <Endpoints extends EndpointsConstraint>(
  httpClient: HTTPClient
): Methods<Endpoints> => {
  return new Proxy({} as Methods<Endpoints>, {
    get: (_, endpoint) => {
      if (typeof endpoint !== "string") {
        return null;
      }

      return async (...params: any[]) => {
        let requestConfig: RequestConfig | undefined;
        if (params[params.length - 1]?._isRequestConfig) {
          requestConfig = params.pop();
        }

        if (requestConfig?.method === "GET") {
          const response = await httpClient.get(endpoint, requestConfig);
          return response;
        }

        return await httpClient.post(endpoint, params, requestConfig);
      };
    },
  }) satisfies Connector;
};

// === Module ===

export const middlewareModule = <Endpoints extends EndpointsConstraint>(
  options: Options
): MiddlewareModule<Endpoints> => {
  const httpClient = getHttpClient(options);
  return {
    connector: middlewareConnector<Endpoints>(httpClient),
  };
};