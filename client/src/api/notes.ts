const fetcher = (...args: any[]) =>
  fetch(...args)
    .then((res) => res.json())
    .then(({ data }) => data);

const apiBaseUrl =
  import.meta.env.VITE_PUBLIC_API_BASE || "http://localhost:9000";

export const getNotes = async () => {
  return fetcher(`${apiBaseUrl}/notes`);
};

export const getNoteById = async (id: string) => {
  return fetcher(`${apiBaseUrl}/notes/${id}`);
};

export const createNote = async (data: { title: string; content: string }) => {
  return fetcher(`${apiBaseUrl}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
};
