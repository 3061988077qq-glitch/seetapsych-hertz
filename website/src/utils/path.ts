const BASE_URL = import.meta.env.BASE_URL;

const withBase = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("#")) {
    return path;
  }
  const normalizedBase = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

export { withBase };
