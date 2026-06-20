import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveRoute } from "./routes";

type RouterContextValue = {
  pathname: string;
  search: string;
  navigate: (path: string) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search
  }));

  useEffect(() => {
    const handlePopState = () => setLocation({ pathname: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      pathname: location.pathname,
      search: location.search,
      navigate: (path) => {
        const nextUrl = new URL(path, window.location.origin);
        if (`${nextUrl.pathname}${nextUrl.search}` === `${window.location.pathname}${window.location.search}`) return;
        window.history.pushState(null, "", path);
        setLocation({ pathname: nextUrl.pathname, search: nextUrl.search });
      }
    }),
    [location.pathname, location.search]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used inside RouterProvider");
  }
  return context;
}

export function useActiveRoute() {
  const { pathname } = useRouter();
  return resolveRoute(pathname);
}
