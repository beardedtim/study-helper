import IfNotNill from "@/components/IfNotNill";
import useNotesAPI from "@/hooks/useNotesAPI";
import { Box, Text } from "@chakra-ui/react";
import { Link } from "wouter";

const EmptyNotesLanding = () => {
  return (
    <Box>
      <Text>No notes available.</Text>
    </Box>
  );
};

const NotesLanding = () => {
  const notesApi = useNotesAPI();

  return (
    <Box>
      <Text>Hello, from Notes</Text>
      {/* Show notes list */}
      <IfNotNill value={notesApi.notes.length}>
        {/* Render notes list here */}
        <Box>
          {notesApi.notes.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`}>
              <Box
                key={note.id}
                border="1px solid"
                padding="4"
                marginBottom="2"
                rounded="md"
              >
                <Text fontWeight="bold">{note.title}</Text>
                <Text>{note.content}</Text>
              </Box>
            </Link>
          ))}
        </Box>
      </IfNotNill>
      <IfNotNill value={!notesApi.notes.length}>
        <EmptyNotesLanding />
      </IfNotNill>
    </Box>
  );
};

export default NotesLanding;
