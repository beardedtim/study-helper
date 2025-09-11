import IfNotNill from "@/components/IfNotNill";
import useNotesAPI from "@/hooks/useNotesAPI";
import { Box, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";

const EmptyNotesLanding = () => {
  return (
    <Box>
      <Text>No notes available.</Text>
    </Box>
  );
};

const NoteLanding = () => {
  const params = useParams();
  const [note, setNote] = useState<any>(null);
  const notesApi = useNotesAPI();

  useEffect(() => {
    console.log(params);
    // Fetch a single note by ID (replace '1' with the actual note ID)
    const fetchNote = async () => {
      if (params.id) {
        const fetchedNote = await notesApi.fetchNoteByID(params.id);
        setNote(fetchedNote);
      }
    };

    fetchNote();
  }, [params.id]);

  if (notesApi.loading) {
    return "loading";
  }

  if (notesApi.error) {
    return `Error: ${notesApi.error}`;
  }

  return (
    <Box>
      <Text>Hello {note?.title}</Text>
    </Box>
  );
};

export default NoteLanding;
