export function generateCanonical(path: string) {
  return {
    alternates: {
      canonical: `https://ringbooker.com${path}`,
    },
  };
}
