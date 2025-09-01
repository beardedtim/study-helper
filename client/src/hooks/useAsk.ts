import { useCallback, useMemo, useState } from "react";
import { fetchEventData } from "fetch-sse";

export interface CurrentQuery {
  query: string;
  why?: string;
}

const useAsk = () => {
  const [userQuery, setuserQuery] = useState("");
  const [userWhy, setUserWhy] = useState<string | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<{ message: string } | undefined>();
  const [response, setResponse] = useState<string>();

  const ask = useCallback(async () => {
    if (!isStreaming) {
      setIsStreaming(true);
      const query = {
        query: userQuery,
        why: userWhy,
      };

      console.log(query, "Asking");

      try {
        await fetchEventData("http://localhost:9000/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data: query,
          onMessage: (event) => {
            if (!event?.event) {
              return;
            }

            switch (event.event) {
              case "ask-started": {
                setResponse(() =>
                  `
# New Question

Asked:

${query.query}

Because:

${query.why ?? "Unknown Reason"}
`.trim()
                );
                break;
              }

              case "action-start": {
                const data = JSON.parse(event.data);
                setResponse((res) =>
                  `

## Started Process

> Process: ${data.name}:${data.id}

                  `.trimEnd()
                );
                break;
              }
              case "action-end": {
                const data = JSON.parse(event.data);

                setResponse((res) =>
                  `
## Step Done

> Process: ${data.id}

## Output

${data.output}

                  `.trimEnd()
                );

                break;
              }
              case "ask-end": {
              }
            }
          },
        });
      } catch (err) {
        console.warn(err);
      } finally {
        setIsStreaming(false);
      }
    } else {
      setError({
        message: "Cannot send message during streaming",
      });
    }
  }, [isStreaming, userQuery, userWhy]);

  return {
    ask,
    query: userQuery,
    why: userWhy,
    setQuery: setuserQuery,
    setWhy: setUserWhy,
    error,
    response,
  };
};

export default useAsk;
