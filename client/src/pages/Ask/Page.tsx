import { Box, Button, ButtonGroup, Textarea } from "@chakra-ui/react";
import { Prose } from "@/components/ui/prose";

import "./style.css";
import useAsk from "../../hooks/useAsk";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function App() {
  const { ask, query, why, setQuery, setWhy, response } = useAsk();

  return (
    <Box display="flex" width="full" height="full">
      <Box width="25%">
        <Box>
          <Textarea
            name="query"
            rows={10}
            aria-label="Question to ask"
            title="Question to ask"
            placeholder="What is the meaning of life and the universe?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoresize
          />
        </Box>
        <Box>
          <Textarea
            name="why"
            rows={10}
            aria-label="Why are you asking it?"
            title="Why are you asking it?"
            placeholder="I want to know what joke my friend is referencing"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            autoresize
          />
        </Box>
        <Box>
          <ButtonGroup>
            <Button
              type="reset"
              variant="subtle"
              colorPalette="red"
              onClick={() => {
                setQuery("");
                setWhy("");
              }}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              colorPalette="blue"
              type="submit"
              onClick={() => {
                ask();
              }}
            >
              Ask
            </Button>
          </ButtonGroup>
        </Box>
      </Box>
      <Box width="75%" height="full" overflowY="auto" padding="4">
        {response && (
          <Prose>
            <Markdown remarkPlugins={[remarkGfm]}>{response}</Markdown>
          </Prose>
        )}
      </Box>
    </Box>
  );
}

export default App;
