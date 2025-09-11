import * as NotesAPI from "../api/notes";
import { useState, useEffect, useCallback } from "react";

const useNotesAPI = () => {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await NotesAPI.getNotes();
      setNotes(data);
    } catch (error) {
      setError("Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  }, []);

  const createNote = useCallback(
    async (data: { title: string; content: string }) => {
      setLoading(true);
      setError(null);
      try {
        const newNote = await NotesAPI.createNote(data);
        setNotes((prevNotes) => [...prevNotes, newNote]);

        return newNote;
      } catch (error) {
        setError("Failed to create note");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchNoteByID = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await NotesAPI.getNoteById(id);
      setNotes((prevNotes) => [...prevNotes, data]);

      return data;
    } catch (error) {
      setError("Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return { notes, loading, error, createNote, fetchNoteByID };
};

export default useNotesAPI;
